export default function Layout({ header, navigation, children }) {
  return (
    <div className="page-shell">
      {header}
      {navigation}
      <main className="layout">{children}</main>
    </div>
  );
}
