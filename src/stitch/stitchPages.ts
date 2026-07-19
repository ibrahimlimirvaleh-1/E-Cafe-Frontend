export type StitchPageMeta = {
  id: string
  label: string
  group: string
  route?: string
}

export const stitchPages: StitchPageMeta[] = [
  {
    "id": "giri_qeydiyyat",
    "label": "Giriş və qeydiyyat",
    "group": "Customer Public",
    "route": "login"
  },
  {
    "id": "restoran_kataloqu",
    "label": "Restoran kataloqu",
    "group": "Customer Public",
    "route": ""
  },
  {
    "id": "restaurant_detail",
    "label": "Restoran detalları",
    "group": "Customer Public",
    "route": "restaurants/:restaurantId"
  },
  {
    "id": "restoran_profili",
    "label": "Restoran profili",
    "group": "Customer Public",
    "route": "restaurants/:restaurantId/profile"
  },
  {
    "id": "masa_se_imi",
    "label": "Masa seçimi",
    "group": "Customer Public",
    "route": "reserve/table"
  },
  {
    "id": "ofisiant_se_imi",
    "label": "Ofisiant seçimi",
    "group": "Customer Public",
    "route": "reserve/waiter"
  },
  {
    "id": "menyu_se_imi",
    "label": "Menyu seçimi",
    "group": "Customer Public",
    "route": "reserve/menu"
  },
  {
    "id": "d_ni_v_t_sdiq",
    "label": "Ödəniş təsdiqi",
    "group": "Customer Public",
    "route": "checkout"
  },
  {
    "id": "customer_account_layout",
    "label": "Müştəri hesab layout",
    "group": "Customer Account",
    "route": "account"
  },
  {
    "id": "rezervasiyalar_m",
    "label": "Rezervasiyalarım",
    "group": "Customer Account",
    "route": "reservations"
  },
  {
    "id": "sifari_l_rim",
    "label": "Sifarişlərim",
    "group": "Customer Account",
    "route": "orders"
  },
  {
    "id": "order_detail_customer",
    "label": "Müştəri sifariş detalı",
    "group": "Customer Account",
    "route": "orders/:orderId"
  },
  {
    "id": "sifari_t_f_rr_atlar_veb",
    "label": "Sifariş təfərrüatları",
    "group": "Customer Account",
    "route": "orders/:orderId/detail"
  },
  {
    "id": "bildiri_l_rim",
    "label": "Bildirişlərim",
    "group": "Customer Account",
    "route": "notifications"
  },
  {
    "id": "i_dar_etm_paneli_naviqasiya_yenil_ndi",
    "label": "Admin dashboard",
    "group": "Admin Core",
    "route": "admin"
  },
  {
    "id": "restaurants_list",
    "label": "Restoranlar siyahısı",
    "group": "Admin Restaurants",
    "route": "admin/restaurants"
  },
  {
    "id": "create_restaurant",
    "label": "Yeni restoran yarat",
    "group": "Admin Restaurants",
    "route": "admin/restaurants/new"
  },
  {
    "id": "edit_restaurant",
    "label": "Restoranı redaktə et",
    "group": "Admin Restaurants",
    "route": "admin/restaurants/:restaurantId/edit"
  },
  {
    "id": "m_qavil_l_r_siyah_s",
    "label": "Müqavilələr siyahısı",
    "group": "Contracts",
    "route": "admin/contracts"
  },
  {
    "id": "yeni_m_qavil_yarat",
    "label": "Yeni müqavilə yarat",
    "group": "Contracts",
    "route": "admin/contracts/new"
  },
  {
    "id": "m_qavil_t_f_rr_atlar",
    "label": "Müqavilə təfərrüatları",
    "group": "Contracts",
    "route": "admin/contracts/:contractId"
  },
  {
    "id": "m_qavil_ni_redakt_et_final",
    "label": "Müqaviləni redaktə et",
    "group": "Contracts",
    "route": "admin/contracts/:contractId/edit"
  },
  {
    "id": "m_qavil_ni_l_v_et_modal",
    "label": "Müqaviləni ləğv et modal",
    "group": "Contracts",
    "route": "admin/contracts/:contractId/terminate"
  },
  {
    "id": "rezervasiyalar_siyah_s_admin",
    "label": "Rezervasiyalar siyahısı",
    "group": "Admin Operations",
    "route": "admin/reservations"
  },
  {
    "id": "rezervasiya_detallar_admin",
    "label": "Rezervasiya detalları",
    "group": "Admin Operations",
    "route": "admin/reservations/:reservationId"
  },
  {
    "id": "sifari_l_r_siyah_s_admin",
    "label": "Sifarişlər siyahısı",
    "group": "Admin Operations",
    "route": "admin/orders"
  },
  {
    "id": "sifari_detallar_admin",
    "label": "Sifariş detalları admin",
    "group": "Admin Operations",
    "route": "admin/orders/:orderId"
  },
  {
    "id": "d_ni_l_r_siyah_s_admin",
    "label": "Ödənişlər siyahısı",
    "group": "Admin Operations",
    "route": "admin/payments"
  },
  {
    "id": "d_ni_t_f_rr_atlar_admin",
    "label": "Ödəniş təfərrüatları",
    "group": "Admin Operations",
    "route": "admin/payments/:paymentId"
  },
  {
    "id": "staff_list",
    "label": "Personal siyahısı",
    "group": "Staff",
    "route": "admin/staff"
  },
  {
    "id": "create_staff",
    "label": "Yeni əməkdaş yarat",
    "group": "Staff",
    "route": "admin/staff/new"
  },
  {
    "id": "staff_detail",
    "label": "Əməkdaş detalları",
    "group": "Staff",
    "route": "admin/staff/:staffId"
  },
  {
    "id": "edit_staff",
    "label": "Əməkdaşı redaktə et",
    "group": "Staff",
    "route": "admin/staff/:staffId/edit"
  },
  {
    "id": "deactivate_staff_modal",
    "label": "Əməkdaşı deaktiv et modal",
    "group": "Staff",
    "route": "admin/staff/:staffId/deactivate"
  },
  {
    "id": "m_tb_x_sifari_l_ri_paneli",
    "label": "Mətbəx sifarişləri paneli",
    "group": "Staff",
    "route": "kitchen"
  },
  {
    "id": "ofisiant_paneli_veb",
    "label": "Ofisiant paneli",
    "group": "Staff",
    "route": "waiter"
  },
  {
    "id": "ofisiant_ana_s_hif_veb",
    "label": "Ofisiant ana səhifə",
    "group": "Staff",
    "route": "waiter/home"
  },
  {
    "id": "ofisiant_sifari_l_ri",
    "label": "Ofisiant sifarişləri",
    "group": "Staff",
    "route": "waiter/orders"
  },
  {
    "id": "tables_list",
    "label": "Masalar siyahısı",
    "group": "Tables",
    "route": "admin/tables"
  },
  {
    "id": "create_table",
    "label": "Yeni masa yarat",
    "group": "Tables",
    "route": "admin/tables/new"
  },
  {
    "id": "table_detail",
    "label": "Masa detalları",
    "group": "Tables",
    "route": "admin/tables/:tableId"
  },
  {
    "id": "edit_table",
    "label": "Masanı redaktə et",
    "group": "Tables",
    "route": "admin/tables/:tableId/edit"
  },
  {
    "id": "deactivate_table_modal",
    "label": "Masanı deaktiv et modal",
    "group": "Tables",
    "route": "admin/tables/:tableId/deactivate"
  },
  {
    "id": "categories_list",
    "label": "Kateqoriyalar siyahısı",
    "group": "Categories",
    "route": "admin/categories"
  },
  {
    "id": "create_category",
    "label": "Yeni kateqoriya yarat",
    "group": "Categories",
    "route": "admin/categories/new"
  },
  {
    "id": "category_detail",
    "label": "Kateqoriya detalları",
    "group": "Categories",
    "route": "admin/categories/:categoryId"
  },
  {
    "id": "edit_category",
    "label": "Kateqoriyanı redaktə et",
    "group": "Categories",
    "route": "admin/categories/:categoryId/edit"
  },
  {
    "id": "deactivate_category_modal",
    "label": "Kateqoriyanı deaktiv et modal",
    "group": "Categories",
    "route": "admin/categories/:categoryId/deactivate"
  },
  {
    "id": "menu_items_list",
    "label": "Menyu elementləri",
    "group": "Menu",
    "route": "admin/menu"
  },
  {
    "id": "create_menu_item",
    "label": "Yeni menyu elementi",
    "group": "Menu",
    "route": "admin/menu/new"
  },
  {
    "id": "menu_item_detail",
    "label": "Menyu elementi detalları",
    "group": "Menu",
    "route": "admin/menu/:itemId"
  },
  {
    "id": "edit_menu_item",
    "label": "Menyu elementini redaktə et",
    "group": "Menu",
    "route": "admin/menu/:itemId/edit"
  },
  {
    "id": "deactivate_menu_item_modal",
    "label": "Menyu elementini deaktiv et modal",
    "group": "Menu",
    "route": "admin/menu/:itemId/deactivate"
  },
  {
    "id": "payment_detail_admin",
    "label": "Ödəniş detalı köhnə variant",
    "group": "Legacy"
  },
  {
    "id": "payments_list_admin",
    "label": "Ödənişlər siyahısı köhnə variant",
    "group": "Legacy"
  },
  {
    "id": "reservation_detail_admin",
    "label": "Rezervasiya detalı köhnə variant",
    "group": "Legacy"
  },
  {
    "id": "reservations_list_admin",
    "label": "Rezervasiyalar siyahısı köhnə variant",
    "group": "Legacy"
  },
  {
    "id": "sifari_l_r_siyah_s",
    "label": "Sifarişlər siyahısı köhnə variant",
    "group": "Legacy"
  },
  {
    "id": "terminate_contract_modal",
    "label": "Müqavilə ləğv modal köhnə variant",
    "group": "Legacy"
  }
]

export const stitchRoutes = stitchPages.filter((page) => Boolean(page.route))
