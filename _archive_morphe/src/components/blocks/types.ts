export type BlockKind =
  | "header"
  | "properties"
  | "checklist"
  | "text"
  | "media"
  | "actions";

export interface HeaderBlockData {
  kind: "header";
  title: string;
  subtitle?: string;
  badge?: string;
  status?: string;
  iconName?: string;
}

export interface PropertyItem {
  label: string;
  value: string;
  iconName?: string;
}

export interface PropertiesBlockData {
  kind: "properties";
  items: PropertyItem[];
}

export interface ChecklistItem {
  id: string;
  text: string;
  done?: boolean;
}

export interface ChecklistBlockData {
  kind: "checklist";
  title?: string;
  items: ChecklistItem[];
}

export interface TextBlockData {
  kind: "text";
  content: string;
  variant?: "plain" | "quote" | "callout" | "notes";
  author?: string;
  source?: string;
}

export interface MediaBlockData {
  kind: "media";
  url?: string;
  alt?: string;
  caption?: string;
  aspect?: "cover" | "square" | "wide";
}

export interface ActionLink {
  label: string;
  url: string;
  iconName?: string;
}

export interface ActionsBlockData {
  kind: "actions";
  links?: ActionLink[];
  rating?: number; // 1-5
  statusOptions?: string[];
  currentStatus?: string;
}

export type CardBlock =
  | HeaderBlockData
  | PropertiesBlockData
  | ChecklistBlockData
  | TextBlockData
  | MediaBlockData
  | ActionsBlockData;

export interface BlockCardData {
  summary: string;
  blocks: CardBlock[];
}
