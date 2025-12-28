/* eslint-disable */
const details = () => ({
  id: "Sarcasm_Tdarr_Plugin_HEVC_NVENC_Watermark_Scaling",
  Stage: "Pre-processing",
  Name: "HEVC NVENC Encoding with Watermark and Scaling by Sarcasm",
  Type: "Video",
  Operation: "Transcode",
  Description: `
    Converts videos to HEVC (H.265) with NVIDIA NVENC hardware acceleration.
    
    Features:
    - Hardware-accelerated encoding with CUDA
    - Constant Quantization Parameter (CQP) for consistent quality
    - Automatic scaling to max. 1280x720 (if larger)
    - 10-bit YUV420 color format
    - Optional: Watermark with configurable position and size
    - Preserves audio and subtitle streams
    - Retains all metadata
    Made by Sarcasm
  `,
  Version: "1.1",
  Tags: "pre-processing,ffmpeg,nvenc,hevc,h265,hardware,nvidia,watermark",
  Inputs: [
    {
      name: "output_container",
      type: "string",
      defaultValue: "mkv",
      inputUI: {
        type: "dropdown",
        options: ["mkv", "mp4", "mov", "avi"],
      },
      tooltip: "Output container format",
    },
    {
      name: "target_cqp",
      type: "number",
      defaultValue: 23,
      inputUI: {
        type: "text",
      },
      tooltip: `
        CQP value for quality (lower = better quality, larger file)
        Recommended: 19-28
        Default: 23
      `,
    },
    {
      name: "rc_lookahead",
      type: "number",
      defaultValue: 20,
      inputUI: {
        type: "text",
      },
      tooltip: `
        Rate Control Lookahead frames
        Higher values improve quality but require more VRAM
        Recommended: 0-32
        Default: 20
      `,
    },
    {
      name: "max_width",
      type: "number",
      defaultValue: 1280,
      inputUI: {
        type: "text",
      },
      tooltip: "Maximum width in pixels",
    },
    {
      name: "max_height",
      type: "number",
      defaultValue: 720,
      inputUI: {
        type: "text",
      },
      tooltip: "Maximum height in pixels",
    },
    {
      name: "enable_10bit",
      type: "boolean",
      defaultValue: true,
      inputUI: {
        type: "dropdown",
        options: ["true", "false"],
      },
      tooltip: "Enable 10-bit color depth (yuv420p10le). Disable for 8-bit (yuv420p)",
    },
    {
      name: "remove_images",
      type: "boolean",
      defaultValue: false,
      inputUI: {
        type: "dropdown",
        options: ["true", "false"],
      },
      tooltip: "Remove embedded images (cover art, thumbnails) from video file",
    },
    {
      name: "enable_watermark",
      type: "boolean",
      defaultValue: false,
      inputUI: {
        type: "dropdown",
        options: ["true", "false"],
      },
      tooltip: "Enable/disable watermark",
    },
    {
      name: "watermark_text",
      type: "string",
      defaultValue: "Sample",
      inputUI: {
        type: "text",
      },
      tooltip: "Text for the watermark",
    },
    {
      name: "watermark_position",
      type: "string",
      defaultValue: "bottom_left",
      inputUI: {
        type: "dropdown",
        options: [
          "top_left",
          "top_right",
          "bottom_left",
          "bottom_right",
          "center",
          "custom",
        ],
      },
      tooltip: "Position of the watermark",
    },
    {
      name: "watermark_x",
      type: "string",
      defaultValue: "10",
      inputUI: {
        type: "text",
      },
      tooltip: "X-position (only for 'custom' position). Examples: 10, W-tw-10, (W-tw)/2",
    },
    {
      name: "watermark_y",
      type: "string",
      defaultValue: "H-th-10",
      inputUI: {
        type: "text",
      },
      tooltip: "Y-position (only for 'custom' position). Examples: 10, H-th-10, (H-th)/2",
    },
    {
      name: "watermark_fontsize",
      type: "number",
      defaultValue: 14,
      inputUI: {
        type: "text",
      },
      tooltip: "Font size of the watermark (8-72)",
    },
    {
      name: "font_path",
      type: "string",
      defaultValue: "./app/configs/royalcocktail.ttf",
      inputUI: {
        type: "text",
      },
      tooltip: "Path to font file (TTF)",
    },
  ],
});

const plugin = (file, librarySettings, inputs, otherArguments) => {
  const lib = require('../methods/lib')();
  inputs = lib.loadDefaultValues(inputs, details);

  const response = {
    processFile: false,
    preset: '',
    container: `.${inputs.output_container}`,
    handBrakeMode: false,
    FFmpegMode: true,
    reQueueAfter: false,
    infoLog: '',
  };

  // Check if video stream exists
  if (!file.ffProbeData || !file.ffProbeData.streams) {
    response.infoLog += '☒ No stream information found\n';
    return response;
  }

  const videoStream = file.ffProbeData.streams.find(
    (stream) => stream.codec_type === 'video'
  );

  if (!videoStream) {
    response.infoLog += '☒ No video stream found\n';
    return response;
  }

  // Check if already HEVC encoded
  if (videoStream.codec_name === 'hevc') {
    response.infoLog += '☑ Video is already HEVC encoded\n';
    return response;
  }

  // Determine watermark position
  let watermarkX = '10';
  let watermarkY = 'H-th-10';

  if (inputs.enable_watermark) {
    switch (inputs.watermark_position) {
      case 'top_left':
        watermarkX = '10';
        watermarkY = '10';
        break;
      case 'top_right':
        watermarkX = 'W-tw-10';
        watermarkY = '10';
        break;
      case 'bottom_left':
        watermarkX = '10';
        watermarkY = 'H-th-10';
        break;
      case 'bottom_right':
        watermarkX = 'W-tw-10';
        watermarkY = 'H-th-10';
        break;
      case 'center':
        watermarkX = '(W-tw)/2';
        watermarkY = '(H-th)/2';
        break;
      case 'custom':
        watermarkX = inputs.watermark_x;
        watermarkY = inputs.watermark_y;
        break;
    }
  }

  // Build video filter
  const colorFormat = inputs.enable_10bit ? 'yuv420p10le' : 'yuv420p';
  let videoFilter = `scale='if(gt(iw\\,${inputs.max_width})\\,${inputs.max_width}\\,iw):if(gt(ih\\,${inputs.max_height})\\,${inputs.max_height}\\,ih):force_original_aspect_ratio=decrease',format=${colorFormat}`;

  if (inputs.enable_watermark) {
    videoFilter += `,drawtext=text='${inputs.watermark_text}':x=${watermarkX}:y=${watermarkY}:fontfile=${inputs.font_path}:fontsize=${inputs.watermark_fontsize}:fontcolor=pink@0.7:shadowcolor=black@0.7:shadowx=5:shadowy=5`;
  }

  // Build FFmpeg command
  response.processFile = true;
  
  // Build stream mapping
  let streamMapping = '';
  if (inputs.remove_images) {
    // Only map video, audio, and subtitle streams (exclude attached pictures/thumbnails)
    streamMapping = '-map 0:v:0 -map 0:a -map 0:s?';
  } else {
    // Map all streams
    streamMapping = '-map 0';
  }
  
  response.preset = `
    -hwaccel cuda
    ${streamMapping}
    -c:v hevc_nvenc
    -rc constqp
    -qp ${inputs.target_cqp}
    -rc-lookahead ${inputs.rc_lookahead}
    -c:a copy
    -c:s copy
    -map_metadata 0
    -vf ${videoFilter}
  `;

  response.infoLog += `☒ Converting video to HEVC
Codec: ${videoStream.codec_name} → hevc (NVENC)
Container: ${inputs.output_container}
Color Depth: ${inputs.enable_10bit ? '10-bit' : '8-bit'}
CQP: ${inputs.target_cqp}
RC Lookahead: ${inputs.rc_lookahead} frames
Max Resolution: ${inputs.max_width}x${inputs.max_height}
Remove Images: ${inputs.remove_images ? 'Yes' : 'No'}
Watermark: ${inputs.enable_watermark ? 'Enabled' : 'Disabled'}`;

  if (inputs.enable_watermark) {
    response.infoLog += `
  - Text: "${inputs.watermark_text}"
  - Position: ${inputs.watermark_position}
  - Font Size: ${inputs.watermark_fontsize}px`;
  }

  response.infoLog += `
Hardware: NVIDIA CUDA Acceleration
`;

  return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
