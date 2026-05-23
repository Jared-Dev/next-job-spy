'use client';

import { Textarea } from '@mantine/core';
import { useReducedMotion } from '@mantine/hooks';
import { useEffect, useState } from 'react';

/**
 * Optional-directive input for resume/cover-letter generation. Its placeholder
 * cycles through example directives, typed out one character at a time, so the
 * field explains itself. The animation is skipped when the OS requests reduced
 * motion or once the user has typed something.
 */

/** Example directives for tailoring a resume. */
export const RESUME_DIRECTIVE_HINTS = [
  'Emphasize the design-system and component-API work',
  'Lead with my accessibility experience',
  'Trim the older roles to two bullets each',
  'Surface the exact keywords from the requirements',
  'Foreground team scope and leadership',
  'Keep it to a single page',
];

/** Example directives for a cover letter. */
export const COVER_LETTER_DIRECTIVE_HINTS = [
  'Open on my component-library experience',
  'Say specifically why I want to work here',
  'Lead with the accessibility working-group work',
  'Make the tone warmer and less formal',
  'Keep it under 200 words',
  'Connect my recent project to their roadmap',
];

function useTypewriterPlaceholder(phrases: string[], active: boolean): string {
  const reduceMotion = useReducedMotion();
  const [text, setText] = useState(phrases[0] ?? '');

  useEffect(() => {
    if (!active || reduceMotion || phrases.length < 2) return;

    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const phrase = phrases[phraseIndex];
      if (deleting) {
        charIndex -= 1;
        setText(phrase.slice(0, charIndex));
        if (charIndex <= 0) {
          deleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
          timer = setTimeout(tick, 360);
          return;
        }
        timer = setTimeout(tick, 18);
        return;
      }
      charIndex += 1;
      setText(phrase.slice(0, charIndex));
      if (charIndex >= phrase.length) {
        deleting = true;
        timer = setTimeout(tick, 2400);
        return;
      }
      timer = setTimeout(tick, 42);
    };

    timer = setTimeout(tick, 800);
    return () => clearTimeout(timer);
  }, [active, reduceMotion, phrases]);

  return text;
}

export function DirectiveField({
  phrases,
  value,
  onChange,
}: {
  phrases: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const placeholder = useTypewriterPlaceholder(phrases, value.trim().length === 0);

  return (
    <Textarea
      label="Generation directive (optional)"
      description="Steer this generation. It is applied on top of your profile and the job, and never overrides the no-fabrication rule."
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      autosize
      minRows={2}
      maxRows={4}
    />
  );
}
