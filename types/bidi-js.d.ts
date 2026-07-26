declare module "bidi-js" {
  interface BidiParagraph {
    start: number;
    end: number;
    level: number;
  }

  interface EmbeddingLevels {
    levels: Uint8Array;
    paragraphs: BidiParagraph[];
  }

  interface Bidi {
    getBidiCharTypeName(character: string): string;
    getEmbeddingLevels(
      text: string,
      explicitDirection?: "ltr" | "rtl",
    ): EmbeddingLevels;
  }

  export default function bidiFactory(): Bidi;
}
