# Restoran qrupu email UI inteqrasiyası

## Məqsəd

Restoran yaradılmasında email sahəsi filial blokunda idi və istifadəçidə “bu filialın emailidir, yoxsa sahibkarın emailidir?” qarışıqlığı yaradırdı. Yeni modelə uyğun olaraq rəsmi əlaqə emaili restoran qrupu səviyyəsinə keçirildi və filial emaili frontend modelindən çıxarıldı.

## Dəyişən kodlar

- `src/entities/types.ts`
  - `RestaurantGroup` tipinə optional `email` sahəsi əlavə edildi.
  - `Restaurant.email` çıxarıldı, əvəzinə `restaurantGroupEmail` istifadə olunur.

- `src/shared/api/ecafeApi.ts`
  - `CreateRestaurantGroupRequest` artıq `email` göndərə bilir.
  - `CreateRestaurantRequest` daxilindən filial `email` çıxarıldı.
  - `restaurantGroupEmail` payload sahəsi əlavə edildi.
  - Restoran yaratma FormData-sına `RestaurantGroupEmail` əlavə edildi.
  - Restoran update JSON payload-ına `restaurantGroupEmail` əlavə edildi.
  - Qrup response mapper-i `email` dəyərini oxuyur.

- `src/pages/admin/RestaurantManagementPage.tsx`
  - “Profil və filial” blokundan email sahəsi çıxarıldı.
  - Yeni qrup yaradıldıqda “Qrup əlaqə emaili” sahəsi əlavə edildi.
  - Mövcud qrup seçiləndə həmin qrupun emaili ayrıca məlumat kimi göstərilir.
  - Restoran yaratma request-i artıq filial emaili deyil, qrup emaili göndərir.

- `src/pages/admin/RestaurantGroupsPage.tsx`
  - Qrup yaratma formasına “Qrup əlaqə emaili” əlavə edildi.
  - Qrup siyahısında email göstərilir.

- `src/pages/admin/RestaurantEditPage.tsx`
  - Filial emaili edit formasından çıxarıldı.
  - Yeni qrup yaradılarsa qrup emaili daxil etmək mümkündür.

- `src/pages/admin/RestaurantDetailPage.tsx`
  - Detalda yalnız `restaurantGroupEmail` gələndə “Qrup emaili” kimi göstərilir.

- `src/shared/api/mappers.ts`
  - Restoran mapper-i `restaurantGroupEmail` oxuyur.
  - Backend deploy ardıcıllığı üçün köhnə `email` field-inə müvəqqəti fallback saxlanılıb.

- `src/styles/globals.css`
  - Mövcud qrup seçiləndə qrup emailini göstərən kiçik məlumat paneli üçün responsive və oxunaqlı stil əlavə edildi.

## UX nəticəsi

- İstifadəçi restoran filialı yaradanda yalnız filiala aid məlumatları filial blokunda görür.
- Biznes/rəsmi əlaqə emaili restoran qrupu kontekstində görünür.
- Sahibkar emaili ayrıca “Sahibkar” bölməsində qalır və login/hesab emaili kimi anlaşılır.

## Yoxlama

- `npm run build` uğurla keçdi.
- Build zamanı yalnız əvvəlki Vite/Rollup chunk xəbərdarlıqları çıxdı; compile xətası yoxdur.
