import { type NodeTypes } from "@xyflow/react";
import { PromptNode } from "./PromptNode";
import { ImageInputNode } from "./ImageInputNode";
import { MediaInputNode } from "./MediaInputNode";
import { LLMNode } from "./LLMNode";
import { ImageNode } from "./ImageNode";
import { VideoNode } from "./VideoNode";
import { OutputNode } from "./OutputNode";
import { NoteNode } from "./NoteNode";

export const nodeTypes: NodeTypes = {
  prompt: PromptNode,
  imageInput: ImageInputNode,
  mediaInput: MediaInputNode,
  llm: LLMNode,
  imageGen: ImageNode,
  videoGen: VideoNode,
  output: OutputNode,
  note: NoteNode,
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
    description: "Upload image or video",
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
    type: "videoGen",
    label: "Video Gen",
    description: "Generate videos",
    color: "bg-blue-700",
    icon: "clapperboard",
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
    description: "Canvas annotation",
    color: "bg-yellow-600",
    icon: "stickyNote",
  },
];
