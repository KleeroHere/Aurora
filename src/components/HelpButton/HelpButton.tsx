import { useHelp } from "../../help/HelpContext";
import Icon from "../icons/Icon";
import "./HelpButton.css";

export default function HelpButton() {
  const { openScreenHelp } = useHelp();

  return (
    <button
      type="button"
      className="help-button"
      data-help="help-button"
      onClick={openScreenHelp}
      title="Hints for this screen"
      aria-label="Hints for this screen"
    >
      <Icon name="help" size={22} />
    </button>
  );
}
