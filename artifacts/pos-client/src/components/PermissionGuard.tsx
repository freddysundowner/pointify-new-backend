import { usePermissions } from '@/hooks/usePermissions';

interface PermissionGuardProps {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const PermissionGuard = ({ 
  permission, 
  permissions = [], 
  requireAll = false, 
  fallback = null, 
  children 
}: PermissionGuardProps) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isAdmin } = usePermissions();

  if (isAdmin) {
    return <>{children}</>;
  }

  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions.length > 0) {
    hasAccess = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);
  } else {
    hasAccess = true; // No restrictions if no permissions specified
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};

interface RouteGuardProps {
  route: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const RouteGuard = ({ route, fallback = null, children }: RouteGuardProps) => {
  const { canAccessRoute, isAdmin } = usePermissions();

  if (isAdmin || canAccessRoute(route)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};