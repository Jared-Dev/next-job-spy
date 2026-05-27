/**
 * Hosts the @modal parallel slot for the job-detail route. When the user
 * clicks "Open resume" from the TailorPanel, the intercepting route at
 * @modal/(...)resume/[artifactId]/page.tsx fires and renders the resume as
 * an overlay; otherwise the @modal slot's default.tsx renders nothing.
 *
 * Hard nav to /resume/[id] still hits the standalone page at
 * app/resume/[artifactId]/page.tsx.
 */
export default function JobDetailLayout({
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
