import type { Hook } from "@civic/hook-common";
import { describe, expect, it } from "vitest";
import { HookChain, LinkedListHook } from "./hookChain.js";

// Mock Hook implementations for testing
class MockHook implements Hook {
  constructor(private _name: string) {}

  get name(): string {
    return this._name;
  }
}

describe("LinkedListHook", () => {
  it("should wrap a hook and maintain reference to next", () => {
    const mockHook = new MockHook("test-hook");
    const linkedHook = new LinkedListHook(mockHook);

    expect(linkedHook.hook).toBe(mockHook);
    expect(linkedHook.next).toBeNull();
    expect(linkedHook.name).toBe("test-hook");
    expect(linkedHook.isLast).toBe(true);
  });

  it("should allow setting and getting next hook", () => {
    const hook1 = new MockHook("hook1");
    const hook2 = new MockHook("hook2");

    const linkedHook1 = new LinkedListHook(hook1);
    const linkedHook2 = new LinkedListHook(hook2);

    linkedHook1.next = linkedHook2;

    expect(linkedHook1.next).toBe(linkedHook2);
    expect(linkedHook1.isLast).toBe(false);
    expect(linkedHook2.isLast).toBe(true);
    expect(linkedHook1.isFirst).toBe(true);
    expect(linkedHook2.isFirst).toBe(true); // No previous set yet
  });

  it("should support bidirectional linking", () => {
    const hook1 = new MockHook("hook1");
    const hook2 = new MockHook("hook2");
    const hook3 = new MockHook("hook3");

    const linkedHook1 = new LinkedListHook(hook1);
    const linkedHook2 = new LinkedListHook(hook2);
    const linkedHook3 = new LinkedListHook(hook3);

    // Link forward and backward
    linkedHook1.next = linkedHook2;
    linkedHook2.previous = linkedHook1;
    linkedHook2.next = linkedHook3;
    linkedHook3.previous = linkedHook2;

    // Test forward traversal
    expect(linkedHook1.next).toBe(linkedHook2);
    expect(linkedHook2.next).toBe(linkedHook3);
    expect(linkedHook3.next).toBeNull();

    // Test backward traversal
    expect(linkedHook3.previous).toBe(linkedHook2);
    expect(linkedHook2.previous).toBe(linkedHook1);
    expect(linkedHook1.previous).toBeNull();

    // Test position checks
    expect(linkedHook1.isFirst).toBe(true);
    expect(linkedHook1.isLast).toBe(false);
    expect(linkedHook2.isFirst).toBe(false);
    expect(linkedHook2.isLast).toBe(false);
    expect(linkedHook3.isFirst).toBe(false);
    expect(linkedHook3.isLast).toBe(true);
  });

  it("should be created with next hook in constructor", () => {
    const hook1 = new MockHook("hook1");
    const hook2 = new MockHook("hook2");

    const linkedHook2 = new LinkedListHook(hook2);
    const linkedHook1 = new LinkedListHook(hook1, linkedHook2);

    expect(linkedHook1.next).toBe(linkedHook2);
    expect(linkedHook1.isLast).toBe(false);
  });
});

describe("HookChain", () => {
  describe("constructor", () => {
    it("should create empty chain", () => {
      const chain = new HookChain();

      expect(chain.head).toBeNull();
      expect(chain.tail).toBeNull();
      expect(chain.length).toBe(0);
      expect(chain.isEmpty).toBe(true);
    });

    it("should create chain from array of hooks", () => {
      const hooks = [
        new MockHook("hook1"),
        new MockHook("hook2"),
        new MockHook("hook3"),
      ];

      const chain = new HookChain(hooks);

      expect(chain.length).toBe(3);
      expect(chain.isEmpty).toBe(false);
      expect(chain.head?.name).toBe("hook1");
      expect(chain.tail?.name).toBe("hook3");
    });

    it("should create single-node chain from single hook", () => {
      const hook = new MockHook("single-hook");
      const chain = new HookChain([hook]);

      expect(chain.length).toBe(1);
      expect(chain.head?.hook).toBe(hook);
      expect(chain.tail?.hook).toBe(hook);
      expect(chain.head).toBe(chain.tail);
    });
  });

  describe("linked list structure", () => {
    it("should properly link hooks in order with bidirectional links", () => {
      const hooks = [
        new MockHook("first"),
        new MockHook("second"),
        new MockHook("third"),
      ];

      const chain = new HookChain(hooks);
      const head = chain.head;
      const tail = chain.tail;

      // Test forward traversal
      expect(head).not.toBeNull();
      expect(head?.name).toBe("first");
      expect(head?.next?.name).toBe("second");
      expect(head?.next?.next?.name).toBe("third");
      expect(head?.next?.next?.next).toBeNull();

      // Test backward traversal
      expect(tail).not.toBeNull();
      expect(tail?.name).toBe("third");
      expect(tail?.previous?.name).toBe("second");
      expect(tail?.previous?.previous?.name).toBe("first");
      expect(tail?.previous?.previous?.previous).toBeNull();

      // Test bidirectional integrity
      expect(head?.isFirst).toBe(true);
      expect(head?.isLast).toBe(false);
      expect(tail?.isFirst).toBe(false);
      expect(tail?.isLast).toBe(true);
    });

    it("should maintain correct head and tail references", () => {
      const hooks = [
        new MockHook("first"),
        new MockHook("middle"),
        new MockHook("last"),
      ];

      const chain = new HookChain(hooks);

      expect(chain.head?.name).toBe("first");
      expect(chain.tail?.name).toBe("last");
      expect(chain.head?.isLast).toBe(false);
      expect(chain.tail?.isLast).toBe(true);
    });
  });

  describe("append", () => {
    it("should append to empty chain", () => {
      const chain = new HookChain();
      const hook = new MockHook("new-hook");

      chain.append(hook);

      expect(chain.length).toBe(1);
      expect(chain.head?.hook).toBe(hook);
      expect(chain.tail?.hook).toBe(hook);
      expect(chain.head).toBe(chain.tail);
    });

    it("should append to existing chain", () => {
      const initialHook = new MockHook("initial");
      const chain = new HookChain([initialHook]);
      const newHook = new MockHook("appended");

      chain.append(newHook);

      expect(chain.length).toBe(2);
      expect(chain.head?.name).toBe("initial");
      expect(chain.tail?.name).toBe("appended");
      expect(chain.head?.next).toBe(chain.tail);
    });

    it("should append multiple hooks correctly", () => {
      const chain = new HookChain();
      const hooks = [
        new MockHook("first"),
        new MockHook("second"),
        new MockHook("third"),
      ];

      hooks.forEach((hook) => chain.append(hook));

      expect(chain.length).toBe(3);
      expect(chain.getNames()).toEqual(["first", "second", "third"]);
    });
  });

  describe("prepend", () => {
    it("should prepend to empty chain", () => {
      const chain = new HookChain();
      const hook = new MockHook("new-hook");

      chain.prepend(hook);

      expect(chain.length).toBe(1);
      expect(chain.head?.hook).toBe(hook);
      expect(chain.tail?.hook).toBe(hook);
    });

    it("should prepend to existing chain", () => {
      const initialHook = new MockHook("initial");
      const chain = new HookChain([initialHook]);
      const newHook = new MockHook("prepended");

      chain.prepend(newHook);

      expect(chain.length).toBe(2);
      expect(chain.head?.name).toBe("prepended");
      expect(chain.tail?.name).toBe("initial");
      expect(chain.head?.next).toBe(chain.tail);
    });
  });

  describe("removeFirst", () => {
    it("should return null for empty chain", () => {
      const chain = new HookChain();
      const result = chain.removeFirst();

      expect(result).toBeNull();
      expect(chain.length).toBe(0);
    });

    it("should remove and return first hook from single-item chain", () => {
      const hook = new MockHook("only-hook");
      const chain = new HookChain([hook]);

      const result = chain.removeFirst();

      expect(result).toBe(hook);
      expect(chain.length).toBe(0);
      expect(chain.head).toBeNull();
      expect(chain.tail).toBeNull();
      expect(chain.isEmpty).toBe(true);
    });

    it("should remove and return first hook from multi-item chain", () => {
      const hooks = [
        new MockHook("first"),
        new MockHook("second"),
        new MockHook("third"),
      ];
      const chain = new HookChain(hooks);

      const result = chain.removeFirst();

      expect(result).toBe(hooks[0]);
      expect(chain.length).toBe(2);
      expect(chain.head?.name).toBe("second");
      expect(chain.tail?.name).toBe("third");
      // Check that backward links are properly updated
      expect(chain.head?.previous).toBeNull();
      expect(chain.head?.isFirst).toBe(true);
    });
  });

  describe("removeLast", () => {
    it("should return null for empty chain", () => {
      const chain = new HookChain();
      const result = chain.removeLast();

      expect(result).toBeNull();
      expect(chain.length).toBe(0);
    });

    it("should remove and return last hook from single-item chain", () => {
      const hook = new MockHook("only-hook");
      const chain = new HookChain([hook]);

      const result = chain.removeLast();

      expect(result).toBe(hook);
      expect(chain.length).toBe(0);
      expect(chain.head).toBeNull();
      expect(chain.tail).toBeNull();
      expect(chain.isEmpty).toBe(true);
    });

    it("should remove and return last hook from multi-item chain", () => {
      const hooks = [
        new MockHook("first"),
        new MockHook("second"),
        new MockHook("third"),
      ];
      const chain = new HookChain(hooks);

      const result = chain.removeLast();

      expect(result).toBe(hooks[2]);
      expect(chain.length).toBe(2);
      expect(chain.head?.name).toBe("first");
      expect(chain.tail?.name).toBe("second");
      // Check that forward links are properly updated
      expect(chain.tail?.next).toBeNull();
      expect(chain.tail?.isLast).toBe(true);
    });
  });

  describe("findByName", () => {
    it("should return null for empty chain", () => {
      const chain = new HookChain();
      const result = chain.findByName("nonexistent");

      expect(result).toBeNull();
    });

    it("should return null for non-existent hook", () => {
      const hooks = [new MockHook("hook1"), new MockHook("hook2")];
      const chain = new HookChain(hooks);

      const result = chain.findByName("hook3");

      expect(result).toBeNull();
    });

    it("should find hook by name", () => {
      const hooks = [
        new MockHook("first"),
        new MockHook("target"),
        new MockHook("third"),
      ];
      const chain = new HookChain(hooks);

      const result = chain.findByName("target");

      expect(result).not.toBeNull();
      expect(result?.name).toBe("target");
      expect(result?.hook).toBe(hooks[1]);
    });

    it("should return first match for duplicate names", () => {
      const hook1 = new MockHook("duplicate");
      const hook2 = new MockHook("duplicate");
      const chain = new HookChain([hook1, hook2]);

      const result = chain.findByName("duplicate");

      expect(result?.hook).toBe(hook1);
    });
  });

  describe("toArray", () => {
    it("should return empty array for empty chain", () => {
      const chain = new HookChain();
      const result = chain.toArray();

      expect(result).toEqual([]);
    });

    it("should return array of hooks in order", () => {
      const hooks = [
        new MockHook("first"),
        new MockHook("second"),
        new MockHook("third"),
      ];
      const chain = new HookChain(hooks);

      const result = chain.toArray();

      expect(result).toEqual(hooks);
      expect(result).not.toBe(hooks); // Should be a new array
    });
  });

  describe("getNames", () => {
    it("should return empty array for empty chain", () => {
      const chain = new HookChain();
      const result = chain.getNames();

      expect(result).toEqual([]);
    });

    it("should return array of hook names in order", () => {
      const hooks = [
        new MockHook("alpha"),
        new MockHook("beta"),
        new MockHook("gamma"),
      ];
      const chain = new HookChain(hooks);

      const result = chain.getNames();

      expect(result).toEqual(["alpha", "beta", "gamma"]);
    });
  });

  describe("toReverseArray", () => {
    it("should return empty array for empty chain", () => {
      const chain = new HookChain();
      const result = chain.toReverseArray();

      expect(result).toEqual([]);
    });

    it("should return array of hooks in reverse order", () => {
      const hooks = [
        new MockHook("first"),
        new MockHook("second"),
        new MockHook("third"),
      ];
      const chain = new HookChain(hooks);

      const result = chain.toReverseArray();

      expect(result).toEqual([hooks[2], hooks[1], hooks[0]]);
      expect(result).not.toBe(hooks); // Should be a new array
    });
  });

  describe("getReverseNames", () => {
    it("should return empty array for empty chain", () => {
      const chain = new HookChain();
      const result = chain.getReverseNames();

      expect(result).toEqual([]);
    });

    it("should return array of hook names in reverse order", () => {
      const hooks = [
        new MockHook("alpha"),
        new MockHook("beta"),
        new MockHook("gamma"),
      ];
      const chain = new HookChain(hooks);

      const result = chain.getReverseNames();

      expect(result).toEqual(["gamma", "beta", "alpha"]);
    });
  });

  describe("iterator", () => {
    it("should iterate through empty chain", () => {
      const chain = new HookChain();
      const items = [...chain];

      expect(items).toEqual([]);
    });

    it("should iterate through chain in order", () => {
      const hooks = [
        new MockHook("first"),
        new MockHook("second"),
        new MockHook("third"),
      ];
      const chain = new HookChain(hooks);

      const items = [...chain];

      expect(items).toHaveLength(3);
      expect(items[0].name).toBe("first");
      expect(items[1].name).toBe("second");
      expect(items[2].name).toBe("third");
    });

    it("should work with for...of loop", () => {
      const hooks = [new MockHook("hook1"), new MockHook("hook2")];
      const chain = new HookChain(hooks);

      const names: string[] = [];
      for (const linkedHook of chain) {
        names.push(linkedHook.name);
      }

      expect(names).toEqual(["hook1", "hook2"]);
    });
  });

  describe("iterateBackward", () => {
    it("should iterate through empty chain backward", () => {
      const chain = new HookChain();
      const items = [...chain.iterateBackward()];

      expect(items).toEqual([]);
    });

    it("should iterate through chain in reverse order", () => {
      const hooks = [
        new MockHook("first"),
        new MockHook("second"),
        new MockHook("third"),
      ];
      const chain = new HookChain(hooks);

      const items = [...chain.iterateBackward()];

      expect(items).toHaveLength(3);
      expect(items[0].name).toBe("third");
      expect(items[1].name).toBe("second");
      expect(items[2].name).toBe("first");
    });

    it("should work with for...of loop backward", () => {
      const hooks = [
        new MockHook("hook1"),
        new MockHook("hook2"),
        new MockHook("hook3"),
      ];
      const chain = new HookChain(hooks);

      const names: string[] = [];
      for (const linkedHook of chain.iterateBackward()) {
        names.push(linkedHook.name);
      }

      expect(names).toEqual(["hook3", "hook2", "hook1"]);
    });
  });

  describe("complex scenarios", () => {
    it("should handle building and modifying chain", () => {
      // Start with empty chain
      const chain = new HookChain();

      // Add some hooks
      chain.append(new MockHook("second"));
      chain.prepend(new MockHook("first"));
      chain.append(new MockHook("third"));

      expect(chain.getNames()).toEqual(["first", "second", "third"]);
      expect(chain.length).toBe(3);

      // Remove first
      const removed = chain.removeFirst();
      expect(removed?.name).toBe("first");
      expect(chain.getNames()).toEqual(["second", "third"]);
      expect(chain.length).toBe(2);

      // Find a hook
      const found = chain.findByName("third");
      expect(found?.name).toBe("third");
      expect(found?.isLast).toBe(true);
    });

    it("should maintain bidirectional chain integrity after multiple operations", () => {
      const initialHooks = [
        new MockHook("a"),
        new MockHook("b"),
        new MockHook("c"),
      ];
      const chain = new HookChain(initialHooks);

      // Add more hooks
      chain.prepend(new MockHook("start"));
      chain.append(new MockHook("end"));

      // Verify forward chain structure
      let current = chain.head;
      const forwardNames: string[] = [];

      while (current !== null) {
        forwardNames.push(current.name);
        current = current.next;
      }

      expect(forwardNames).toEqual(["start", "a", "b", "c", "end"]);

      // Verify backward chain structure
      current = chain.tail;
      const backwardNames: string[] = [];

      while (current !== null) {
        backwardNames.push(current.name);
        current = current.previous;
      }

      expect(backwardNames).toEqual(["end", "c", "b", "a", "start"]);

      // Verify chain properties
      expect(chain.length).toBe(5);
      expect(chain.head?.name).toBe("start");
      expect(chain.tail?.name).toBe("end");
      expect(chain.head?.isFirst).toBe(true);
      expect(chain.tail?.isLast).toBe(true);

      // Test removal operations maintain integrity
      const removedFirst = chain.removeFirst();
      const removedLast = chain.removeLast();

      expect(removedFirst?.name).toBe("start");
      expect(removedLast?.name).toBe("end");
      expect(chain.length).toBe(3);
      expect(chain.head?.name).toBe("a");
      expect(chain.tail?.name).toBe("c");
      expect(chain.head?.previous).toBeNull();
      expect(chain.tail?.next).toBeNull();
    });

    it("should support bidirectional iteration consistency", () => {
      const hooks = [
        new MockHook("first"),
        new MockHook("second"),
        new MockHook("third"),
        new MockHook("fourth"),
      ];
      const chain = new HookChain(hooks);

      // Forward iteration
      const forwardNames = [...chain].map((hook) => hook.name);
      expect(forwardNames).toEqual(["first", "second", "third", "fourth"]);

      // Backward iteration
      const backwardNames = [...chain.iterateBackward()].map(
        (hook) => hook.name,
      );
      expect(backwardNames).toEqual(["fourth", "third", "second", "first"]);

      // Both should have same length
      expect(forwardNames.length).toBe(backwardNames.length);
      expect(forwardNames.reverse()).toEqual(backwardNames);
    });
  });
});
