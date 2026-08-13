export type P<T> = { [K in keyof T]: T[K] } & {}

export type Coordinate = { x: number; y: number }
