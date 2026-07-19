export type StitchPageMeta = {
  id: string
  title: string
  route?: string
}

export const stitchPages: StitchPageMeta[] = [
  { id: 'restoran_kataloqu', title: 'Restoran kataloqu', route: '/' },
  { id: 'restoran_profili', title: 'Restoran profili', route: '/restaurants/:restaurantId' },
  { id: 'masa_se_imi', title: 'Masa seçimi', route: '/restaurants/:restaurantId/tables' },
  { id: 'ofisiant_se_imi', title: 'Ofisiant seçimi', route: '/restaurants/:restaurantId/waiters' },
  { id: 'menyu_se_imi', title: 'Menyu seçimi', route: '/restaurants/:restaurantId/menu' },
  { id: 'd_ni_v_t_sdiq', title: 'Ödəniş və təsdiq', route: '/confirmation' },
  { id: 'i_dar_etm_paneli_naviqasiya_yenil_ndi', title: 'Admin dashboard', route: '/admin' },
  { id: 'm_qavil_l_r_siyah_s', title: 'Müqavilələr', route: '/admin/contracts' },
  { id: 'yeni_m_qavil_yarat', title: 'Yeni müqavilə', route: '/admin/contracts/new' },
  { id: 'm_qavil_t_f_rr_atlar', title: 'Müqavilə detalları', route: '/admin/contracts/:contractId' },
  { id: 'm_qavil_ni_redakt_et_final', title: 'Müqaviləni redaktə et', route: '/admin/contracts/:contractId/edit' },
  { id: 'm_qavil_ni_l_v_et_modal', title: 'Müqaviləni ləğv et', route: '/admin/contracts/:contractId/terminate' },
  { id: 'reservations_list_admin', title: 'Rezervasiyalar', route: '/admin/reservations' },
  { id: 'sifari_l_r_siyah_s_admin', title: 'Sifarişlər', route: '/admin/orders' },
  { id: 'payments_list_admin', title: 'Ödənişlər', route: '/admin/payments' },
  { id: 'staff_list', title: 'Personal', route: '/admin/staff' },
  { id: 'tables_list', title: 'Masalar', route: '/admin/tables' },
  { id: 'categories_list', title: 'Kateqoriyalar', route: '/admin/categories' },
  { id: 'menu_items_list', title: 'Menyu elementləri', route: '/admin/menu' },
  { id: 'm_tb_x_sifari_l_ri_paneli', title: 'Kitchen', route: '/kitchen' },
  { id: 'ofisiant_paneli_veb', title: 'Waiter', route: '/waiter' },
  { id: 'giri_qeydiyyat', title: 'Giriş/Qeydiyyat', route: '/login' },
]
