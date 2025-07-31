import type { NextApiRequest, NextApiResponse } from 'next';
import {
  IvsClient,
  ListChannelsCommand,
  GetStreamCommand,
  GetChannelCommand,
  UpdateChannelCommand,
  CreateChannelCommand,
  ListStreamKeysCommand,
  GetStreamKeyCommand,
  CreateStreamKeyCommand,
} from '@aws-sdk/client-ivs';

const ivs = new IvsClient({ region: 'ap-south-1' });
const RECORDING_CONFIG_ARN = process.env.IVS_RECORDING_CONFIG_ARN!;

/*───────────────────────────────────────────────────────── helpers ────*/
function isChannelNotBroadcastingError(e: unknown): e is { name: string } {
  return typeof e === 'object' && e !== null && 'name' in e && e.name === 'ChannelNotBroadcasting';
}

async function ensureKeyValue(channelArn: string): Promise<string> {
  const list = await ivs.send(new ListStreamKeysCommand({ channelArn, maxResults: 1 }));
  if (list.streamKeys?.length) {
    const { streamKey } = await ivs.send(
      new GetStreamKeyCommand({ arn: list.streamKeys[0].arn })
    );
    return streamKey!.value!;
  }
  const { streamKey } = await ivs.send(new CreateStreamKeyCommand({ channelArn }));
  return streamKey!.value!;
}

/*──────────────────────────────────────── allocate channel ────*/
/* allocateChannel now takes an optional Set<string> of ARNs to ignore */
async function allocateChannel(
  uuid: string,
  kind: 'SCREEN' | 'CAMERA',
  exclude: Set<string> = new Set()
) {
  const desiredName = `${kind}_${uuid}`;

  // 1️⃣ list channels tied to our recording config
  const { channels } = await ivs.send(
    new ListChannelsCommand({ filterByRecordingConfigurationArn: RECORDING_CONFIG_ARN })
  );

  for (const c of channels ?? []) {
    if (exclude.has(c.arn!)) continue;                 // skip ones we already chose

    try {
      await ivs.send(new GetStreamCommand({ channelArn: c.arn! })); // LIVE → skip
    } catch (err) {
      if (isChannelNotBroadcastingError(err)) {
        // idle channel found – rename and use it
        await ivs.send(new UpdateChannelCommand({ arn: c.arn!, name: desiredName }));
        const { channel } = await ivs.send(new GetChannelCommand({ arn: c.arn! }));
        const streamKeyValue = await ensureKeyValue(c.arn!);
        return { channelArn: c.arn!, ingestEndpoint: channel!.ingestEndpoint!, streamKey: streamKeyValue };
      }
      throw err;
    }
  }

  // 2️⃣ create a new channel when none are idle
  const { channel } = await ivs.send(
    new CreateChannelCommand({
      name: desiredName,
      type: 'BASIC',
      latencyMode: 'LOW',
      recordingConfigurationArn: RECORDING_CONFIG_ARN,
      authorized: false,
    })
  );
  const streamKeyValue = await ensureKeyValue(channel!.arn!);
  return { channelArn: channel!.arn!, ingestEndpoint: channel!.ingestEndpoint!, streamKey: streamKeyValue };
}


/*────────────────────────────────────────────────── API handler ────*/
/* API handler — sequential + exclude set */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { examId } = req.body as { examId: string };

  try {
    const used = new Set<string>();

    const screen = await allocateChannel(examId, 'SCREEN', used);
    used.add(screen.channelArn);                       // don't reuse this ARN

    const camera = await allocateChannel(examId, 'CAMERA', used);

    res.status(200).json({
      screen: { ingestEndpoint: screen.ingestEndpoint, streamKey: screen.streamKey },
      camera: { ingestEndpoint: camera.ingestEndpoint, streamKey: camera.streamKey },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'IVS error' });
  }
}

