import { useEffect, useState } from "react";
import { getMaterialsBySection, getSections, subscribe } from "./repository";
import type { MaterialSummary, Section } from "./types";

export interface SectionWithMaterials {
  section: Section;
  materials: MaterialSummary[];
}

interface ContentIndex {
  sectionGroups: SectionWithMaterials[];
  loading: boolean;
}

async function loadSectionGroups(): Promise<SectionWithMaterials[]> {
  const sections = await getSections();
  const visible = sections.filter((section) => !section.hidden);
  return Promise.all(
    visible.map(async (section) => ({
      section,
      materials: await getMaterialsBySection(section._id),
    })),
  );
}

export function useContentIndex(): ContentIndex {
  const [sectionGroups, setSectionGroups] = useState<SectionWithMaterials[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    function refresh() {
      loadSectionGroups().then((groups) => {
        if (!cancelled) {
          setSectionGroups(groups);
          setLoading(false);
        }
      });
    }

    refresh();
    const unsubscribe = subscribe(() => refresh());

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { sectionGroups, loading };
}
