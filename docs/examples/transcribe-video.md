# Transcribe a video

This example shows how to build a video transcription pipeline that extracts audio from a video file and then transcribes it to text. The pipeline handles file validation, simulates processing steps, and demonstrates error recovery when transcription fails.

::: code-group

```ts twoslash [Chaining style]
import { Result } from "typescript-result";
// ---cut-start---
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class TranscribeAudioFailedError extends Error {
  readonly type = "transcribe-audio-failed-error";
}

class IncorrectFilenameError extends Error {
  readonly type = "incorrect-filename-error";
}
// ---cut-end---

function extractAudioFromVideo(videoPath: string) {
  return Result.fromAsync(async () => {
    if (!videoPath.endsWith(".mp4")) {
      return Result.error(
        new IncorrectFilenameError("Video file must be an MP4 file"),
      );
    }

    await sleep(100); // Simulate audio extraction process

    const audioPath = videoPath.replace(/\.mp4$/, ".mp3");
    return Result.ok(audioPath);
  });
}

function transcribeAudio(audioPath: string) {
  return Result.fromAsync(async () => {
    await sleep(100); // Simulate transcription process

    if (Math.random() < 0.5) {
      return Result.error(
        new TranscribeAudioFailedError("Transcription failed"),
      );
    }

    return Result.ok(`Transcription of ${audioPath}`);
  });
}

function transcribeVideo(videoPath: string) {
  return extractAudioFromVideo(videoPath)
    .map((audioPath) =>
      transcribeAudio(audioPath).recover(
        () => "Default transcription due to error",
      ),
    )
}

const result = await transcribeVideo("example.mp4");
//    ^?
```

```ts twoslash [Generator style]
import { Result } from "typescript-result";
// ---cut-start---
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class TranscribeAudioFailedError extends Error {
  readonly type = "transcribe-audio-failed-error";
}

class IncorrectFilenameError extends Error {
  readonly type = "incorrect-filename-error";
}
// ---cut-end---

async function* extractAudioFromVideo(videoPath: string) {
  if (!videoPath.endsWith(".mp4")) {
    return yield* Result.error(
      new IncorrectFilenameError("Video file must be an MP4 file"),
    );
  }

  await sleep(100); // Simulate audio extraction process

  return videoPath.replace(/\.mp4$/, ".mp3");
}

async function* transcribeAudio(audioPath: string) {
  await sleep(100); // Simulate transcription process

  if (Math.random() < 0.5) {
    return yield* Result.error(
      new TranscribeAudioFailedError("Transcription failed"),
    );
  }

  return `Transcription of ${audioPath}`;
}

async function* transcribeVideo(videoPath: string) {
  const audioPath = yield* extractAudioFromVideo(videoPath);

  const transcription = yield* Result.gen(transcribeAudio(audioPath))
    .recover(() => "Default transcription due to error");

  return transcription;
}

const result = await Result.gen(transcribeVideo("example.mp4"));
//    ^?
```

```ts twoslash [Errors]
class TranscribeAudioFailedError extends Error {
  readonly type = "transcribe-audio-failed-error";
}

class IncorrectFilenameError extends Error {
  readonly type = "incorrect-filename-error";
}
```