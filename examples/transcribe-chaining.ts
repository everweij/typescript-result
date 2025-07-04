import path from "node:path";
import { Result } from "typescript-result";

class TranscribeAudioFailedError extends Error {
	readonly type = "transcribe-audio-failed-error";
}

class IncorrectFilenameError extends Error {
	readonly type = "incorrect-filename-error";
}

function extractAudioFromVideo(videoPath: string) {
	return Result.fromAsync(async () => {
		if (!videoPath.endsWith(".mp4")) {
			return Result.error(
				new IncorrectFilenameError("Video file must be an MP4 file"),
			);
		}

		// Simulate audio extraction process

		const audioPath = videoPath.replace(/\.mp4$/, ".mp3");
		return Result.ok(audioPath);
	});
}

function transcribeAudio(audioPath: string) {
	return Result.fromAsync(async () => {
		// Simulate transcription process

		if (Math.random() < 0.5) {
			return Result.error(
				new TranscribeAudioFailedError("Transcription failed"),
			);
		}

		return Result.ok(`Transcription of ${path.basename(audioPath)}`);
	});
}

function transcribeVideo(videoPath: string) {
	return extractAudioFromVideo(videoPath)
		.map((audioPath) =>
			transcribeAudio(audioPath).recover(
				() => "Default transcription due to error",
			),
		)
		.getOrElse((error) => `Error: ${error.message}`);
}

console.log(await transcribeVideo("example.mp4"));
