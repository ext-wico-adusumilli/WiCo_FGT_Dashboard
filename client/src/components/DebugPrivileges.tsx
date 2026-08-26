import { useAuth } from '../hooks/useAuth';
import { usePrivileges } from '../hooks/usePrivileges';
import { useTheme } from '../contexts/ThemeContext';

export function DebugPrivileges() {
  const { user } = useAuth();
  const privileges = usePrivileges();
  const { theme } = useTheme();

  if (!user) return null;

  return (
    <div className={`fixed bottom-4 right-4 p-4 rounded-lg border max-w-md max-h-96 overflow-auto z-50 ${
      theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
    }`}>
      <h3 className="font-bold mb-2">Debug: Current Privileges</h3>
      <div className="text-xs space-y-1">
        <p><strong>User:</strong> {user.email}</p>
        <p><strong>Role:</strong> {user.role}</p>
        <hr className="my-2" />
        <p><strong>Can Access:</strong></p>
        <ul className="ml-4 space-y-1">
          <li>General Overview: {privileges.canAccessGeneralOverview() ? '✅' : '❌'}</li>
          <li>MTTF Dashboard: {privileges.canAccessMTTFDashboard() ? '✅' : '❌'}</li>
          <li>Weather Station: {privileges.canAccessWeatherStation() ? '✅' : '❌'}</li>
          <li>Log Details: {privileges.canAccessLogDetails() ? '✅' : '❌'}</li>
          <li>LTE Connectivity: {privileges.canAccessLTEConnectivity() ? '✅' : '❌'}</li>
          <li>User Management: {privileges.canAccessUserManagement() ? '✅' : '❌'}</li>
        </ul>
        <hr className="my-2" />
        <details>
          <summary className="cursor-pointer">Raw Privileges</summary>
          <pre className="mt-2 text-xs overflow-auto">
            {JSON.stringify(user.privileges, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
