// src/pages/api/ivs.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import {
  ListStreamKeysCommand,
  CreateStreamKeyCommand,
  GetStreamKeyCommand,
  GetChannelCommand,
  StreamKey,
} from '@aws-sdk/client-ivs';
import { ivs } from '@/lib/ivs';

const SCREEN_CHANNEL = process.env.IVS_CHANNEL_SCREEN_ARN!;
const CAMERA_CHANNEL = process.env.IVS_CHANNEL_CAMERA_ARN!;

/** returns an existing key or creates one if none exist */
async function ensureKey(channelArn: string, examId: string): Promise<StreamKey> {
    // 1️⃣ look for an existing key
    const list = await ivs.send(
      new ListStreamKeysCommand({ channelArn, maxResults: 1 })
    );
  
    if (list.streamKeys?.length) {
      // 2️⃣ fetch the secret value for that key
      const { streamKey } = await ivs.send(
        new GetStreamKeyCommand({ arn: list.streamKeys[0].arn })
      );
      return streamKey!;
    }
  
    // 3️⃣ none exists → create a new one
    const { streamKey } = await ivs.send(
      new CreateStreamKeyCommand({ channelArn, tags: { examId } })
    );
    return streamKey!;
  }
  

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { examId } = req.body as { examId: string };

  try {
    const [screenKey, camKey, screenChan, camChan] = await Promise.all([
      ensureKey(SCREEN_CHANNEL, examId),
      ensureKey(CAMERA_CHANNEL, examId),
      ivs.send(new GetChannelCommand({ arn: SCREEN_CHANNEL })),
      ivs.send(new GetChannelCommand({ arn: CAMERA_CHANNEL })),
    ]);

    res.status(200).json({
      screen: {
        ingestEndpoint: screenChan.channel!.ingestEndpoint,
        streamKey: screenKey.value,
      },
      camera: {
        ingestEndpoint: camChan.channel!.ingestEndpoint,
        streamKey: camKey.value,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'IVS error' });
  }
}
