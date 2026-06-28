export type File = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
export type Rank = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
export type Square = `${File}${Rank}`;

export interface BoardMove {
  from: Square;
  to: Square;
}

export interface BoardArrow {
  from: Square;
  to: Square;
  label?: string;
}

export interface ShowPositionInput {
  fen?: string;
  orientation?: "white" | "black";
  caption?: string;
  highlights?: Square[];
  arrows?: BoardArrow[];
  lastMove?: BoardMove | null;
}

export interface BoardState {
  fen: string;
  orientation: "white" | "black";
  caption: string;
  highlights: Square[];
  arrows: BoardArrow[];
  lastMove: BoardMove | null;
}
