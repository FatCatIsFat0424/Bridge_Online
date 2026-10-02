import { describe, expect, it } from 'vitest';
import { extractEmojiNames, splitEmojiText } from '@shared/constants';
import { emojiNameFromFile } from '../../../client/src/emoji-names';
import { resolveMessageEmojis } from '../../src/managers/chat-manager';

const MEDIA = `${'a'.repeat(64)}.png`;
const OTHER = `${'b'.repeat(64)}.gif`;

describe('custom emoji helpers', () => {
  it('should extract unique valid :name: tokens in order', () => {
    expect(extractEmojiNames(':wave: hi :ok_2: :wave: :x: :Bad: :ok_2::cat:')).toEqual(['wave', 'ok_2', 'cat']);
    expect(extractEmojiNames('no emoji here: just colons')).toEqual([]);
    expect(extractEmojiNames(`:${'a'.repeat(33)}:`)).toEqual([]);
  });

  it('should split text around attached emoji only', () => {
    expect(splitEmojiText('hi :wave: and :nope:!', { wave: MEDIA })).toEqual([
      'hi ', { name: 'wave', mediaId: MEDIA }, ' and :nope:!',
    ]);
    expect(splitEmojiText(':wave::wave:', { wave: MEDIA })).toEqual([
      { name: 'wave', mediaId: MEDIA }, { name: 'wave', mediaId: MEDIA },
    ]);
    expect(splitEmojiText('<b>:toString:</b>')).toEqual(['<b>:toString:</b>']);
    expect(splitEmojiText(':constructor:', {})).toEqual([':constructor:']);
  });

  it('should resolve only names in the sender library, capped at 20', () => {
    const library = [{ name: 'wave', mediaId: MEDIA }, { name: 'cat', mediaId: OTHER }];
    expect(resolveMessageEmojis(':cat: :dog: :wave: :cat:', library)).toEqual({ cat: OTHER, wave: MEDIA });
    expect(resolveMessageEmojis('plain', library)).toEqual({});
    const many = Array.from({ length: 25 }, (_, index) => ({ name: `e${index}`, mediaId: MEDIA }));
    const message = many.map((emoji) => `:${emoji.name}:`).join(' ');
    expect(Object.keys(resolveMessageEmojis(message, many))).toEqual(many.slice(0, 20).map((emoji) => emoji.name));
  });

  it('should derive unique valid names from file names', () => {
    const taken = new Set(['party']);
    expect(emojiNameFromFile('Party.GIF', taken)).toBe('party_2');
    expect(emojiNameFromFile('party.png', taken)).toBe('party_3');
    expect(emojiNameFromFile('folder/Hello World!.webp', taken)).toBe('hello_world_');
    expect(emojiNameFromFile('a.png', taken)).toBe('a_');
    expect(emojiNameFromFile('貓.png', taken)).toBe('__');
    const long = `${'x'.repeat(40)}.png`;
    expect(emojiNameFromFile(long, taken)).toBe('x'.repeat(32));
    expect(emojiNameFromFile(long, taken)).toBe(`${'x'.repeat(30)}_2`);
    for (const name of taken) expect(name).toMatch(/^[a-z0-9_]{2,32}$/);
  });
});
