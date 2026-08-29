import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getMaterialById, getSectionById } from "../../data/repository";
import { MACRO_CATEGORIES } from "../../data/types";
import type { MacroCategory, Material, Section } from "../../data/types";
import "./Breadcrumbs.css";

interface Crumb {
  label: string;
  to?: string;
}

function isMacroCategory(value: string | undefined): value is MacroCategory {
  return value !== undefined && value in MACRO_CATEGORIES;
}

function macroCrumb(macro: MacroCategory): Crumb {
  return { label: MACRO_CATEGORIES[macro], to: `/macro/${macro}` };
}

function useBreadcrumbSection(id: string | undefined): Section | null {
  const [section, setSection] = useState<Section | null>(null);

  useEffect(() => {
    if (!id) {
      setSection(null);
      return;
    }
    let cancelled = false;
    getSectionById(id).then((doc) => {
      if (!cancelled) setSection(doc ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return section;
}

function useBreadcrumbMaterial(id: string | undefined): Material | null {
  const [material, setMaterial] = useState<Material | null>(null);

  useEffect(() => {
    if (!id) {
      setMaterial(null);
      return;
    }
    let cancelled = false;
    getMaterialById(id).then((doc) => {
      if (!cancelled) setMaterial(doc ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return material;
}

export default function Breadcrumbs() {
  const location = useLocation();
  const params = useParams<{ sectionId?: string; materialId?: string; macroId?: string; tag?: string }>();

  const sectionIdFromRoute = params.sectionId ? decodeURIComponent(params.sectionId) : undefined;
  const materialIdFromRoute = params.materialId ? decodeURIComponent(params.materialId) : undefined;
  const macroId = isMacroCategory(params.macroId) ? params.macroId : undefined;
  const tagFromRoute = params.tag ? decodeURIComponent(params.tag) : undefined;

  const isEdit = location.pathname.endsWith("/edit");
  const isNewMaterial = location.pathname === "/material/new";
  const isSettings = location.pathname === "/settings";
  const isAdmin = location.pathname === "/admin";
  const isMaterialRoute = Boolean(materialIdFromRoute) && !isNewMaterial;

  const material = useBreadcrumbMaterial(isMaterialRoute ? materialIdFromRoute : undefined);
  const sectionIdToLoad = sectionIdFromRoute ?? (material ? material.sectionId : undefined);
  const section = useBreadcrumbSection(sectionIdToLoad);

  if (location.pathname === "/") {
    return null;
  }

  let crumbs: Crumb[] = [];

  if (isSettings) {
    crumbs = [{ label: "Settings" }];
  } else if (isAdmin) {
    crumbs = [{ label: "Admin" }];
  } else if (isNewMaterial) {
    crumbs = [{ label: "New material" }];
  } else if (tagFromRoute) {
    crumbs = [{ label: "Tag" }, { label: `#${tagFromRoute}` }];
  } else if (macroId) {
    crumbs = [macroCrumb(macroId)];
  } else if (isMaterialRoute) {
    if (section && material) {
      crumbs = [
        macroCrumb(section.macroCategory),
        { label: section.title, to: `/section/${encodeURIComponent(section._id)}` },
        { label: material.title, to: `/material/${encodeURIComponent(material._id)}` },
      ];
      if (isEdit) crumbs.push({ label: "Editing" });
    }
  } else if (sectionIdFromRoute) {
    if (section) {
      crumbs = [
        macroCrumb(section.macroCategory),
        { label: section.title, to: `/section/${encodeURIComponent(section._id)}` },
      ];
    }
  }

  if (crumbs.length === 0) return null;

  const allCrumbs: Crumb[] = [{ label: "Home", to: "/" }, ...crumbs];

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumbs" data-help="breadcrumbs">
      <ol className="breadcrumbs__list">
        {allCrumbs.map((crumb, index) => {
          const isLast = index === allCrumbs.length - 1;
          return (
            <li key={index} className="breadcrumbs__item">
              {!isLast && crumb.to ? (
                <Link to={crumb.to} className="breadcrumbs__link" title={crumb.label}>
                  {crumb.label}
                </Link>
              ) : (
                <span className="breadcrumbs__current" title={crumb.label}>
                  {crumb.label}
                </span>
              )}
              {!isLast && (
                <span className="breadcrumbs__separator" aria-hidden="true">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
