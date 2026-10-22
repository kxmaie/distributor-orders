import { Link } from "react-router-dom";
import { EmptyState } from "../components/ui";

export default function NotFound() {
  return <EmptyState title="الصفحة غير موجودة" action={<Link to="/" className="btn-primary">الرئيسية</Link>} />;
}
