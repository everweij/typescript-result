import path from "node:path";
import { Result } from "typescript-result";
import { sleep } from "./util.js";

class TranscribeAudioFailedError extends Error {
	readonly type = "transcribe-audio-failed-error";
}

class IncorrectFilenameError extends Error {
	readonly type = "incorrect-filename-error";
}

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

	return `Transcription of ${path.basename(audioPath)}`;
}

async function transcribeVideo(videoPath: string) {
	return Result.gen(async function* () {
		const audioPath = yield* extractAudioFromVideo(videoPath);

		const transcription = yield* Result.gen(transcribeAudio(audioPath)).recover(
			() => "Default transcription due to error",
		);

		return transcription;
	}).getOrElse((error) => `Error: ${error.message}`);
}

console.log(await transcribeVideo("example.mp4"));
