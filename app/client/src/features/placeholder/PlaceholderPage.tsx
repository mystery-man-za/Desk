type PlaceholderPageProps = {
  title: string;
};

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <section className="dashboard placeholder-page">
      <div className="eyebrow">A NEW CHAPTER</div>
      <h1>{title}</h1>
      <p className="welcome-copy">
        This area is ready for its own feature module as the application grows.
      </p>
      <div className="placeholder-card">
        <span className="ready-label"><span /> FOUNDATION READY</span>
        <h2>A place for {title.toLowerCase()}.</h2>
        <p>
          The navigation and page structure are in place. This feature has not
          been implemented yet.
        </p>
      </div>
    </section>
  );
}
