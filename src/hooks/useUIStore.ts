import { create } from 'zustand'

type ModalType = 'addProvider' | 'editProvider' | 'addProfile' | 'editProfile' | 'settings' | null

interface UIState {
  selectedProviderId: string | null
  selectedProfileId: string | null
  activeModal: ModalType
  selectProvider: (id: string | null) => void
  selectProfile: (id: string | null) => void
  openModal: (modal: ModalType) => void
  closeModal: () => void
}

export const useUIStore = create<UIState>((set) => ({
  selectedProviderId: null,
  selectedProfileId: null,
  activeModal: null,

  selectProvider: (id) => set({ selectedProviderId: id, selectedProfileId: null }),
  selectProfile: (id) => set({ selectedProfileId: id, selectedProviderId: null }),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
}))