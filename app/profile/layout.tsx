/**
 * Hosts the @modal parallel slot for /profile. When the user soft-navigates
 * to /profile/story, the intercepting route at
 * @modal/(.)story/page.tsx fires and renders the interview workspace as a
 * full-height modal over /profile; otherwise the @modal slot's default.tsx
 * renders nothing.
 *
 * Hard nav to /profile/story (refresh, new tab, deep link) falls through to
 * the standalone page at app/profile/story/page.tsx.
 */
export default function ProfileLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
