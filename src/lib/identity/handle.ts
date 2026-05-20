const ADJECTIVES = [
  "curious", "quiet", "bright", "swift", "calm", "bold", "kind", "wise",
  "merry", "sunny", "lucky", "lively", "gentle", "mellow", "nimble", "plucky",
  "witty", "cosmic", "amber", "velvet", "sleepy", "happy", "brave", "humble",
];

const ANIMALS = [
  "otter", "fox", "owl", "wolf", "deer", "lynx", "raven", "heron",
  "badger", "rabbit", "swallow", "ferret", "hedgehog", "newt", "wren", "panda",
  "tortoise", "puffin", "magpie", "stoat", "meadow", "yak", "ibex", "tapir",
];

export function generateHandle(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const n = Math.floor(Math.random() * 99) + 1;
  return `${adj}-${animal}-${n}`;
}

const HANDLE_PATTERN = /^[a-z][a-z0-9-]{2,30}$/;
export function isValidHandle(handle: string): boolean {
  return HANDLE_PATTERN.test(handle);
}
