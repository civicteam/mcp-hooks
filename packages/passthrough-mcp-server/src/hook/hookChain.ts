import type { Hook } from "@civic/hook-common";
import type { HookDefinition } from "../proxy/config.js";
import { getHookClients } from "./manager.js";

/**
 * A wrapper around Hook that maintains references to both next and previous hooks in the chain
 */
export class LinkedListHook {
  private _hook: Hook;
  private _next: LinkedListHook | null;
  private _previous: LinkedListHook | null;

  constructor(
    hook: Hook,
    next: LinkedListHook | null = null,
    previous: LinkedListHook | null = null,
  ) {
    this._hook = hook;
    this._next = next;
    this._previous = previous;
  }

  /**
   * Get the wrapped hook
   */
  get hook(): Hook {
    return this._hook;
  }

  /**
   * Get the next hook in the chain
   */
  get next(): LinkedListHook | null {
    return this._next;
  }

  /**
   * Set the next hook in the chain
   */
  set next(next: LinkedListHook | null) {
    this._next = next;
  }

  /**
   * Get the previous hook in the chain
   */
  get previous(): LinkedListHook | null {
    return this._previous;
  }

  /**
   * Set the previous hook in the chain
   */
  set previous(previous: LinkedListHook | null) {
    this._previous = previous;
  }

  /**
   * Check if this is the first hook in the chain
   */
  get isFirst(): boolean {
    return this._previous === null;
  }

  /**
   * Check if this is the last hook in the chain
   */
  get isLast(): boolean {
    return this._next === null;
  }

  /**
   * Get the name of the wrapped hook
   */
  get name(): string {
    return this._hook.name;
  }
}

/**
 * A chain of hooks implemented as a linked list for efficient traversal
 */
export class HookChain {
  private _head: LinkedListHook | null;
  private _tail: LinkedListHook | null;
  private _length: number;

  constructor(hooks: HookDefinition[] = []) {
    this._head = null;
    this._tail = null;
    this._length = 0;

    if (hooks.length > 0) {
      this._buildLinkedList(getHookClients(hooks));
    }
  }

  /**
   * Build the doubly linked list from an array of hooks
   */
  private _buildLinkedList(hooks: Hook[]): void {
    if (hooks.length === 0) return;

    // Create the first node
    this._head = new LinkedListHook(hooks[0]);
    this._tail = this._head;
    this._length = 1;

    // Create and link the rest of the nodes
    let current = this._head;
    for (let i = 1; i < hooks.length; i++) {
      const newNode = new LinkedListHook(hooks[i]);
      // Link forward
      current.next = newNode;
      // Link backward
      newNode.previous = current;

      current = newNode;
      this._tail = newNode;
      this._length++;
    }
  }

  /**
   * Get the first hook in the chain
   */
  get head(): LinkedListHook | null {
    return this._head;
  }

  /**
   * Get the last hook in the chain
   */
  get tail(): LinkedListHook | null {
    return this._tail;
  }

  /**
   * Get the number of hooks in the chain
   */
  get length(): number {
    return this._length;
  }

  /**
   * Check if the chain is empty
   */
  get isEmpty(): boolean {
    return this._length === 0;
  }

  /**
   * Add a hook to the end of the chain
   */
  append(hook: Hook): void {
    const newNode = new LinkedListHook(hook);

    if (this._tail === null) {
      // Empty chain
      this._head = newNode;
      this._tail = newNode;
    } else {
      // Add to the end
      this._tail.next = newNode;
      newNode.previous = this._tail;
      this._tail = newNode;
    }

    this._length++;
  }

  /**
   * Add a hook to the beginning of the chain
   */
  prepend(hook: Hook): void {
    const newNode = new LinkedListHook(hook, this._head);

    if (this._head === null) {
      // Empty chain
      this._tail = newNode;
    } else {
      // Link backward from old head to new head
      this._head.previous = newNode;
    }

    this._head = newNode;
    this._length++;
  }

  /**
   * Remove and return the first hook in the chain
   */
  removeFirst(): Hook | null {
    if (this._head === null) {
      return null;
    }

    const removedHook = this._head.hook;
    this._head = this._head.next;
    this._length--;

    if (this._head === null) {
      // Chain is now empty
      this._tail = null;
    } else {
      // Update backward link
      this._head.previous = null;
    }

    return removedHook;
  }

  /**
   * Remove and return the last hook in the chain
   */
  removeLast(): Hook | null {
    if (this._tail === null) {
      return null;
    }

    const removedHook = this._tail.hook;
    this._tail = this._tail.previous;
    this._length--;

    if (this._tail === null) {
      // Chain is now empty
      this._head = null;
    } else {
      // Update forward link
      this._tail.next = null;
    }

    return removedHook;
  }

  /**
   * Find a hook by name
   */
  findByName(name: string): LinkedListHook | null {
    let current = this._head;

    while (current !== null) {
      if (current.name === name) {
        return current;
      }
      current = current.next;
    }

    return null;
  }

  /**
   * Convert the chain back to an array of hooks
   */
  toArray(): Hook[] {
    const hooks: Hook[] = [];
    let current = this._head;

    while (current !== null) {
      hooks.push(current.hook);
      current = current.next;
    }

    return hooks;
  }

  /**
   * Get an array of hook names in order
   */
  getNames(): string[] {
    const names: string[] = [];
    let current = this._head;

    while (current !== null) {
      names.push(current.name);
      current = current.next;
    }

    return names;
  }

  /**
   * Convert the chain back to an array in reverse order
   */
  toReverseArray(): Hook[] {
    const hooks: Hook[] = [];
    let current = this._tail;

    while (current !== null) {
      hooks.push(current.hook);
      current = current.previous;
    }

    return hooks;
  }

  /**
   * Get an array of hook names in reverse order
   */
  getReverseNames(): string[] {
    const names: string[] = [];
    let current = this._tail;

    while (current !== null) {
      names.push(current.name);
      current = current.previous;
    }

    return names;
  }

  /**
   * Iterate through the chain from head to tail (forward)
   */
  *[Symbol.iterator](): Iterator<LinkedListHook> {
    let current = this._head;

    while (current !== null) {
      yield current;
      current = current.next;
    }
  }

  /**
   * Iterate through the chain from tail to head (backward)
   */
  *iterateBackward(): Iterator<LinkedListHook> {
    let current = this._tail;

    while (current !== null) {
      yield current;
      current = current.previous;
    }
  }
}
