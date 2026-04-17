import TabButton from "./TabButton.jsx";

export default function TabBar({ activeTab, onSelect, tabs }) {
  return (
    <nav className="tab-bar" aria-label="Dashboard sections">
      {tabs.map((tab) => (
        <TabButton
          active={tab.id === activeTab}
          key={tab.id}
          label={tab.label}
          onClick={() => onSelect(tab.id)}
        />
      ))}
    </nav>
  );
}
