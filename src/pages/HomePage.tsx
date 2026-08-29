import { useContentIndex } from "../data/useContentIndex";
import type { MacroCategory } from "../data/types";
import HeroSearch from "../components/HeroSearch/HeroSearch";
import MacroHeroCard from "../components/MacroHeroCard/MacroHeroCard";
import PinnedShelf from "../components/PinnedShelf/PinnedShelf";
import AffirmationWidget from "../components/AffirmationWidget/AffirmationWidget";
import ChangelogWidget from "../components/ChangelogWidget/ChangelogWidget";
import { useTheme } from "../context/ThemeContext";
import { formatShortDate } from "../utils/dateFormat";
import { brandIdentity } from "../context/brandIdentity";
import "./HomePage.css";

const MACRO_ORDER: MacroCategory[] = ["formal", "methods", "instructions", "other"];
const MACRO_SKELETON_COUNT = 3;

export default function HomePage() {
  const { sectionGroups, loading } = useContentIndex();
  const { palette } = useTheme();
  const heroMark = brandIdentity(palette).auroraMark;

  const totalSections = sectionGroups.length;
  const totalMaterials = sectionGroups.reduce((sum, group) => sum + group.materials.length, 0);
  const latestUpdatedAt = sectionGroups
    .flatMap((group) => group.materials)
    .reduce<string | null>((latest, material) => {
      if (!latest || material.updatedAt > latest) return material.updatedAt;
      return latest;
    }, null);

  const macroCards = MACRO_ORDER.map((macro) => {
    const groups = sectionGroups.filter(({ section }) => section.macroCategory === macro);
    return {
      macro,
      sectionCount: groups.length,
      materialCount: groups.reduce((sum, group) => sum + group.materials.length, 0),
    };
  }).filter((entry) => entry.sectionCount > 0);

  return (
    <div className="home-page">
      <section className="home-page__hero">
        <div className="home-page__hero-content">
          <img src={heroMark} alt="" className="home-page__hero-mark" />
          <h1 className="home-page__title">Aurora</h1>
          <p className="home-page__lead">Everything the centre runs on: protocols, forms, shift journals and training videos - offline.</p>
          <HeroSearch />

          {!loading && (
            <dl className="home-page__stats" data-help="home-stats">
              <div className="home-page__stat">
                <dt className="home-page__stat-label text-utility">Materials</dt>
                <dd className="home-page__stat-value">{totalMaterials}</dd>
              </div>
              <div className="home-page__stat-divider" aria-hidden="true" />
              <div className="home-page__stat">
                <dt className="home-page__stat-label text-utility">Sections</dt>
                <dd className="home-page__stat-value">{totalSections}</dd>
              </div>
              <div className="home-page__stat-divider" aria-hidden="true" />
              <div className="home-page__stat">
                <dt className="home-page__stat-label text-utility">Up to date as of</dt>
                <dd className="home-page__stat-value">{latestUpdatedAt ? formatShortDate(latestUpdatedAt) : "—"}</dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      {loading ? (
        <div className="home-page__macro-grid">
          {Array.from({ length: MACRO_SKELETON_COUNT }, (_, i) => (
            <div key={i} className="home-page__macro-skeleton" aria-hidden="true" />
          ))}
        </div>
      ) : (
        <div className="home-page__macro-grid cascade-grid" data-help="home-macro-grid">
          {macroCards.map(({ macro, sectionCount, materialCount }) => (
            <MacroHeroCard key={macro} macro={macro} sectionCount={sectionCount} materialCount={materialCount} />
          ))}
        </div>
      )}

      <PinnedShelf />

      <div className="home-page__widgets">
        <AffirmationWidget />
        <ChangelogWidget />
      </div>
    </div>
  );
}
