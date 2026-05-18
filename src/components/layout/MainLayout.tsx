import { AnimatePresence } from 'framer-motion'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { ProviderList } from '../provider/ProviderList'
import { DetailPanel } from './DetailPanel'
import { AddProviderModal } from '../provider/AddProviderModal'
import { EditProviderModal } from '../provider/EditProviderModal'
import { AddProfileModal } from '../profile/AddProfileModal'
import { EditProfileModal } from '../profile/EditProfileModal'
import { SettingsModal } from '../settings/SettingsModal'
import { Toast } from '../common/Toast'
import { useUIStore } from '@/hooks/useUIStore'

export function MainLayout() {
  const { activeModal, closeModal, selectedProviderId, selectedProfileId } = useUIStore()

  return (
    <div className="h-screen flex flex-col bg-[var(--background)]">
      <TopBar />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-auto p-6 bg-[var(--background)]">
          <ProviderList />
        </main>

        <DetailPanel />
      </div>

      <AnimatePresence>
        {activeModal === 'addProvider' && (
          <AddProviderModal onClose={closeModal} />
        )}
        {activeModal === 'addProfile' && (
          <AddProfileModal onClose={closeModal} />
        )}
        {activeModal === 'editProvider' && selectedProviderId && (
          <EditProviderModal onClose={closeModal} providerId={selectedProviderId} />
        )}
        {activeModal === 'editProfile' && selectedProfileId && (
          <EditProfileModal onClose={closeModal} profileId={selectedProfileId} />
        )}
        {activeModal === 'settings' && (
          <SettingsModal onClose={closeModal} />
        )}
      </AnimatePresence>

      <Toast />
    </div>
  )
}