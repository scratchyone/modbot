import { v4 as uuidv4 } from 'uuid';
export type ValueType = string | number | boolean;
export default class KeyValueStore {
  data: Map<
    string,
    {
      modificationMetadata: {
        id: string;
        /** @type {number} Unix timestamp in ms when key will be deleted */
        deletionTime?: number;
      };
      value: ValueType;
    }
  >;
  constructor() {
    this.data = new Map();
  }
  // Parameters may be declared in a variety of syntactic forms
  /**
   * @param {number?}  timeout The time before the key is deleted in MS
   */
  public set(key: string, value: ValueType, timeout?: number): void {
    const modificationId = uuidv4();
    if (timeout) {
      this.data.set(key, {
        value,
        modificationMetadata: {
          id: modificationId,
          deletionTime: Date.now() + timeout,
        },
      });
      setInterval(() => {
        const gotKey = this.data.get(key);
        if (gotKey && gotKey.modificationMetadata.id === modificationId)
          this.delete(key);
      }, timeout);
    } else
      this.data.set(key, {
        value,
        modificationMetadata: { id: modificationId },
      });
  }
  public timeLeft(key: string): number | undefined {
    const gotKey = this.data.get(key);
    if (gotKey && gotKey.modificationMetadata.deletionTime)
      return gotKey.modificationMetadata.deletionTime - Date.now();
  }
  public add(key: string, amount: number): void {
    const gotKey = this.data.get(key);
    if (!gotKey || typeof gotKey.value !== 'number') {
      throw new Error('Key is not a number');
    }
    this.data.set(key, {
      value: gotKey.value + amount,
      modificationMetadata: gotKey.modificationMetadata,
    });
  }
  /**
   * @param {number?}  timeout The time before the key is deleted in MS, if a new key is created
   */
  public addOrCreate(key: string, amount: number, timeout?: number): void {
    const gotKey = this.data.get(key);
    if (!gotKey) this.set(key, amount, timeout);
    else this.add(key, amount);
  }
  public get(key: string): ValueType | null {
    return this.data.get(key)?.value || null;
  }
  public delete(key: string): boolean {
    return this.data.delete(key);
  }
}
