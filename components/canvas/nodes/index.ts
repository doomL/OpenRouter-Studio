import { type NodeTypes } from "@xyflow/react";
import { PromptNode } from "./PromptNode";
import { ImageInputNode } from "./ImageInputNode";
import { MediaInputNode } from "./MediaInputNode";
import { LLMNode } from "./LLMNode";
import { ImageNode } from "./ImageNode";
import { BackgroundRemovalNode } from "./BackgroundRemovalNode";
import { VideoNode } from "./VideoNode";
import { AudioNode } from "./AudioNode";
import { TranscribeNode } from "./TranscribeNode";
import { OutputNode } from "./OutputNode";
import { NoteNode } from "./NoteNode";
import { FreeTextNode } from "./FreeTextNode";

export const nodeTypes: NodeTypes = {
  prompt: PromptNode,
  imageInput: ImageInputNode,
  mediaInput: MediaInputNode,
  llm: LLMNode,
  imageGen: ImageNode,
  bgRemove: BackgroundRemovalNode,
  videoGen: VideoNode,
  audioGen: AudioNode,
  transcribe: TranscribeNode,
  output: OutputNode,
  note: NoteNode,
  freeText: FreeTextNode,
};

export const nodeDefinitions = [
  {
    type: "prompt",
    label: "Prompt",
    description: "Text input / prompt",
    color: "bg-gray-600",
    icon: "pencil",
  },
  {
    type: "imageInput",
    label: "Image Input",
    description: "Upload or paste image",
    color: "bg-green-700",
    icon: "image",
  },
  {
    type: "mediaInput",
    label: "Media Input",
    description: "Upload image, video, or audio",
    color: "bg-teal-700",
    icon: "upload",
  },
  {
    type: "llm",
    label: "LLM Chat",
    description: "Chat / text completion",
    color: "bg-purple-700",
    icon: "bot",
  },
  {
    type: "imageGen",
    label: "Image Gen",
    description: "Generate images",
    color: "bg-orange-600",
    icon: "palette",
  },
  {
    type: "bgRemove",
    label: "BG Remove",
    description: "Cut out image background",
    color: "bg-emerald-700",
    icon: "scissors",
  },
  {
    type: "videoGen",
    label: "Video Gen",
    description: "Generate videos",
    color: "bg-blue-700",
    icon: "clapperboard",
  },
  {
    type: "audioGen",
    label: "Audio Gen",
    description: "Generate speech or songs",
    color: "bg-pink-700",
    icon: "audio",
  },
  {
    type: "transcribe",
    label: "Transcribe",
    description: "Turn audio into text (speech-to-text)",
    color: "bg-cyan-800",
    icon: "mic",
  },
  {
    type: "output",
    label: "Output",
    description: "View results",
    color: "bg-gray-600",
    icon: "monitor",
  },
  {
    type: "note",
    label: "Note",
    description: "Sticky note on the canvas",
    color: "bg-yellow-600",
    icon: "stickyNote",
  },
  {
    type: "freeText",
    label: "Label",
    description: "Plain text; handles scale font size",
    color: "bg-slate-600",
    icon: "type",
  },
];
