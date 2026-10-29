const fs = require('fs');
const { spawn } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg').path;

const srtContent = `1
00:00:00,000 --> 00:00:03,000
Hello and welcome to HL Video Editor.

2
00:00:03,500 --> 00:00:07,000
Testing burned-in auto captions export.
`;

fs.writeFileSync('temp_test.srt', srtContent);

// Windows paths in ffmpeg subtitle filter must use forward slashes and escaped colons
const srtPath = 'temp_test.srt'.replace(/\\/g, '/');

const args = [
  '-y',
  '-i', 'test_speech_video.mp4',
  '-vf', `subtitles=${srtPath}:force_style='FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Alignment=2,MarginV=40'`,
  '-c:a', 'copy',
  'burned_captions_output.mp4'
];

console.log('Running ffmpeg with args:', args);
const proc = spawn(ffmpeg, args);
let stderr = '';
proc.stderr.on('data', d => stderr += d.toString());
proc.on('close', (code) => {
  console.log('Burned subtitle export finished with code:', code);
  if (code !== 0) {
    console.error('FFmpeg stderr:', stderr.slice(-500));
  } else if (fs.existsSync('burned_captions_output.mp4')) {
    console.log('Exported file size:', fs.statSync('burned_captions_output.mp4').size);
  }
});
