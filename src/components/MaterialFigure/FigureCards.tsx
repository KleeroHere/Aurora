import type { FigureCardsSpec } from "./figureTypes";

export default function FigureCards({ spec }: { spec: FigureCardsSpec }) {
  return (
    <div className="figure-cards">
      {spec.cards.map((card, i) => (
        <article className="figure-cards__card" key={i}>
          <h3 className="figure-cards__title">{card.title}</h3>
          {card.paragraphs.map((text, k) => (
            <p className="figure-cards__paragraph" key={`p${k}`}>
              {text}
            </p>
          ))}
          {card.bullets && (
            <ul className="figure-cards__list">
              {card.bullets.map((text, k) => (
                <li key={`b${k}`}>{text}</li>
              ))}
            </ul>
          )}
          {card.tail?.map((text, k) => (
            <p className="figure-cards__paragraph" key={`t${k}`}>
              {text}
            </p>
          ))}
        </article>
      ))}
    </div>
  );
}
