"use client";

import type { CardProps } from "@/components/intents/types";
import type { CardBlock } from "./types";
import { HeaderBlock } from "./HeaderBlock";
import { PropertiesBlock } from "./PropertiesBlock";
import { ChecklistBlock } from "./ChecklistBlock";
import { TextBlock } from "./TextBlock";
import { MediaBlock } from "./MediaBlock";
import { ActionsBlock } from "./ActionsBlock";

export interface GenericBlockData {
  summary?: string;
  blocks?: CardBlock[];
  [key: string]: any;
}

export function BlockCard({ data, interactive }: CardProps<GenericBlockData>) {
  const blocks: CardBlock[] = data?.blocks || [];

  if (!blocks || blocks.length === 0) {
    return (
      <div className="flex flex-col gap-2 p-1 text-xs text-muted-foreground">
        {data?.summary || "No content"}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 p-1 w-full">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "header":
            return <HeaderBlock key={i} data={block} />;
          case "properties":
            return <PropertiesBlock key={i} data={block} />;
          case "checklist":
            return <ChecklistBlock key={i} data={block} />;
          case "text":
            return <TextBlock key={i} data={block} />;
          case "media":
            return <MediaBlock key={i} data={block} />;
          case "actions":
            return <ActionsBlock key={i} data={block} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
