import { Navigate, Outlet, useParams } from 'react-router-dom';
import { isReservedApexPathSegment } from '@/lib/tenantHost/parsePathTenant';

/** Bloqueia slugs reservados (`/streaming`, `/admin`, …) de serem tratados como tenant em `/:tenantSlug`. */
export function TenantSlugSegmentOutlet() {
  const { tenantSlug = '' } = useParams();
  if (isReservedApexPathSegment(tenantSlug)) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
