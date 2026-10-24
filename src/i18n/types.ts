/** Same shape as the source messages, with every leaf a string. */
export type Messages<T> = { [K in keyof T]: T[K] extends string ? string : Messages<T[K]> }
