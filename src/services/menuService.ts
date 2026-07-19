export type MenuCategory = {
  id: string
  label: string
}

export type MenuItem = {
  id: string
  name: string
  categoryId: string
  categoryLabel: string
  price: number
  description: string
  image: string
  imageAlt: string
}

export type OrderLine = {
  itemId: string
  quantity: number
  note?: string
}

export const menuCategories: MenuCategory[] = [
  { id: 'all', label: 'Hamısı' },
  { id: 'cold-starters', label: 'Soyuq qəlyanaltılar' },
  { id: 'main-dishes', label: 'Əsas yeməklər' },
  { id: 'drinks', label: 'İçkilər' },
  { id: 'desserts', label: 'Şirniyyatlar' },
]

export const menuItems: MenuItem[] = [
  {
    id: 'veg-bouquet',
    name: 'Tərəvəz Buketi',
    categoryId: 'cold-starters',
    categoryLabel: 'Soyuq qəlyanaltı',
    price: 12,
    description: 'Təzə mövsüm tərəvəzləri, yerli göyərtilər və Motal pendiri ilə.',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAo7W5uOjH_9uHf-Xh0xBc5tahwC8r4q0DKl4j_ABObfXUrNceQnfJ-EVTH-69cLlI2zd-EaPjVjfiRRM3_-qJDqw8TUfPZBfWb9NlyOZGhbgVM6O-ZmmRVoi6krLRqos6-7UYZuZGi8OcvoEYy672437662hAUBFcVWWFxMROxnFBUrcdSOYozbSnCTeewduzsnTW1cgZcVPyybWCDiQ-Xt-rRgcGsYIiUKOiEvXHPy4YQGod1b4M34g',
    imageAlt: 'Təzə tərəvəzlər, göyərti və pendir ilə soyuq qəlyanaltı boşqabı',
  },
  {
    id: 'shah-plov',
    name: 'Şah Plov',
    categoryId: 'main-dishes',
    categoryLabel: 'Əsas yemək',
    price: 45,
    description: 'Qazmaqda bişmiş ətirli uzun düyü, quzu əti, qaysı və şabalıd ilə.',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC8fVezDl0pcb_4ihPxXRuCm75TEJuzqGPCnZYONNK3QdD_XaF5ebDPmWLoAXwZrC36WHCnyYp49atq75RU16nFSRn-IpKmlt1ZwB5b60ikyQH9u_v7gegCDcv4PZJZcIvbJjCJitvHwTg1o6z0e8ZCu9KR9d2-QlPLf2RE6vCTXzXOVo3IMd9NKHhfMDdTMASWvhSXE2NVshadSpcR_Ps5k9zn9p3NCn5olO0-0ORJnvCaL0fedRpCGQ',
    imageAlt: 'Ənənəvi Şah Plov, qızılı qazmaq və quru meyvələrlə',
  },
  {
    id: 'pomegranate-drink',
    name: 'Nar Şərbəti',
    categoryId: 'drinks',
    categoryLabel: 'İçki',
    price: 8,
    description: 'Təzə sıxılmış nar şirəsi və xüsusi ədviyyat qarışığı.',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDRP0HSqnlvLQpDpDAdXNtKLwxnqFDc1E-Enq5SbAJBGHJE0vtJXw10K9_cBDUBh4xUXtn8ivaAuVVXwCj0utV32oT-C8fDZyJ_XFGx1TZc5B_Q4QQGq393bEnVpyKN_ECObfUhynMfwSabmIgngoiUb5I-jl_Jf5kornX40xOAIRVahJPiruNMoML0mN6SifSKeH92hpSNviHyv430vHG7KvSsmWtu5nNlSkcKs7XyLIljOCkgzmRw1Q',
    imageAlt: 'Nanə ilə bəzədilmiş nar şərbəti',
  },
  {
    id: 'baku-pakhlava',
    name: 'Bakı Paxlavası',
    categoryId: 'desserts',
    categoryLabel: 'Şirniyyat',
    price: 15,
    description: 'Bal ilə zənginləşdirilmiş, fındıqlı klassik Bakı paxlavası.',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCKpQw6XXiuLFS40HEG07NEgFDj7mRWmXrCihFByl4iZ5GsGoA0oxR90dj75iKuMMU11LSXYkKSvIPRpFqvbXmlWDh9MtjHMSwbew0fzT6L_sq8nunh-46c_4mpzNP6EikR1JpoXZbpl9v0nCJXoKMqVcER653kmYVRV_w-2CSzszsTWX520ScgXwocn5_Yul-754mKZJauq4vXkH4GuZnfktZH4QtllIa5YtXcXF58Sa_v0MhX2XiIXQ',
    imageAlt: 'Bakı paxlavası, qoz və bal qatı ilə',
  },
]

export function getMenuCategories() {
  return menuCategories
}

export function getMenuItems() {
  return menuItems
}
