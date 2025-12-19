// Type declarations for neataptic
// This is a minimal type declaration covering the parts we use

declare module 'neataptic' {
  export interface NetworkJSON {
    nodes: any[];
    connections: any[];
    input: number;
    output: number;
    dropout: number;
  }

  export class Network {
    input: number;
    output: number;
    nodes: Node[];
    connections: Connection[];

    constructor(input?: number, output?: number);

    static fromJSON(json: NetworkJSON): Network;

    activate(input: number[]): number[];
    propagate(rate: number, momentum: number, target: number[]): void;
    toJSON(): NetworkJSON;
    clear(): void;
    clone(): Network;
    mutate(method: any): void;
    crossOver(network: Network, equal?: boolean): Network;

    score?: number;
  }

  export class Node {
    bias: number;
    type: string;
    activation: any;
    squash: any;
  }

  export class Connection {
    from: Node;
    to: Node;
    weight: number;
  }

  export interface NeatOptions {
    population?: Network[];
    popsize?: number;
    elitism?: number;
    provenance?: number;
    mutationRate?: number;
    mutationAmount?: number;
    fitnessPopulation?: boolean;
    selection?: any;
    crossover?: any[];
    mutation?: any[];
    network?: Network;
    equal?: boolean;
    clear?: boolean;
    growth?: number;
    amount?: number;
    cost?: any;
    maxNodes?: number;
    maxConns?: number;
    maxGates?: number;
  }

  export class Neat {
    population: Network[];
    popsize: number;
    elitism: number;
    mutationRate: number;
    mutationAmount: number;
    generation: number;

    constructor(
      input: number,
      output: number,
      fitness?: ((genome: Network) => number) | null,
      options?: NeatOptions
    );

    evolve(): Promise<void>;
    evaluate(dataset?: any): void;
    sort(): void;
    getAverage(): number;
    getOffspring(): Network;
    getFittest(): Network;
    selectMutationMethod(genome: Network): any;
    mutate(): void;
    crossover(): void;
    reproduce(): void;
    export(): NetworkJSON[];
    import(json: NetworkJSON[]): void;
  }

  export namespace methods {
    export namespace selection {
      export const POWER: { name: string };
      export const FITNESS_PROPORTIONATE: { name: string };
      export const TOURNAMENT: { name: string; size: number };
    }

    export namespace crossover {
      export const SINGLE_POINT: { name: string };
      export const TWO_POINT: { name: string };
      export const UNIFORM: { name: string };
      export const AVERAGE: { name: string };
    }

    export namespace mutation {
      export const ADD_NODE: { name: string };
      export const SUB_NODE: { name: string };
      export const ADD_CONN: { name: string };
      export const SUB_CONN: { name: string };
      export const MOD_WEIGHT: { name: string };
      export const MOD_BIAS: { name: string };
      export const MOD_ACTIVATION: { name: string };
      export const ADD_GATE: { name: string };
      export const SUB_GATE: { name: string };
      export const ADD_SELF_CONN: { name: string };
      export const SUB_SELF_CONN: { name: string };
      export const ADD_BACK_CONN: { name: string };
      export const SUB_BACK_CONN: { name: string };
      export const SWAP_NODES: { name: string };
      export const FFW: any[];
      export const ALL: any[];
    }

    export namespace activation {
      export const LOGISTIC: (x: number, derivate: boolean) => number;
      export const TANH: (x: number, derivate: boolean) => number;
      export const IDENTITY: (x: number, derivate: boolean) => number;
      export const RELU: (x: number, derivate: boolean) => number;
      export const SOFTSIGN: (x: number, derivate: boolean) => number;
      export const SINUSOID: (x: number, derivate: boolean) => number;
      export const GAUSSIAN: (x: number, derivate: boolean) => number;
      export const BENT_IDENTITY: (x: number, derivate: boolean) => number;
      export const BIPOLAR: (x: number, derivate: boolean) => number;
      export const BIPOLAR_SIGMOID: (x: number, derivate: boolean) => number;
      export const HARD_TANH: (x: number, derivate: boolean) => number;
      export const ABSOLUTE: (x: number, derivate: boolean) => number;
      export const INVERSE: (x: number, derivate: boolean) => number;
      export const SELU: (x: number, derivate: boolean) => number;
    }
  }

  export namespace architect {
    export function Perceptron(...layers: number[]): Network;
    export function Random(input: number, hidden: number, output: number, options?: any): Network;
    export function LSTM(input: number, ...args: number[]): Network;
    export function GRU(input: number, ...args: number[]): Network;
    export function NARX(input: number, hiddenLayers: number[], output: number, previousInput: number, previousOutput: number): Network;
    export function Hopfield(size: number): Network;
  }
}
