// Same page as /audit, reached from inside the admin section so its top nav
// (Accounts, Shops, Activity Log, Report) stays visible — /audit itself has to
// stay outside /admin since non-admin accounts can open it too.
export { default } from "../../audit/page";
