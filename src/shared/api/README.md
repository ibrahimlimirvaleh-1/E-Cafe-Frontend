# ECafe API struktur qeydi

Bu qovluq frontend-in backend-lə danışdığı yerdir. Səhifələrdə endpoint URL yazmırıq; hamısı burada saxlanılır.

## Fayllar

- `httpClient.ts`  
  Bütün `fetch` sorğuları buradan keçir. JWT token varsa avtomatik `Authorization: Bearer ...` header-i əlavə edir.

- `endpoints.ts`  
  Backend endpoint siyahısıdır. Endpoint dəyişəndə əvvəlcə bu fayla bax.

- `mappers.ts`  
  Backend-dən gələn DTO-ları frontend-in istifadə etdiyi modellərə çevirir. Backend field adı dəyişsə, əsasən burada düzəliş etmək lazımdır.

- `responseUtils.ts`  
  Backend response-larındakı array/string/number/bool kimi dəyərləri təhlükəsiz oxumaq üçün helper-lərdir.

- `ecafeApi.ts`  
  Səhifələrin çağırdığı rahat API facade-dır. Məsələn:
  - `ecafeApi.restaurants.publicList()`
  - `ecafeApi.menu.items(restaurantId)`
  - `ecafeApi.admin.rows('restaurants')`

## Backend hazır olan flow-lar

- Auth: login/register
- Public restaurant catalog/profile
- Public restaurant menu/staff/tables
- Admin restaurant list
- Contract list/flow
- Category/item oxuma

## Backend hələ hazır olmayan flow-lar

Bu bölmələr frontend-də hələ demo/placeholder kimi qalır:

- Reservation
- Walk-in/TableSession
- Order
- Kitchen
- Payment/Settlement
- Notification list/read

Bu endpoint-lər backend-də yazılanda əvvəl `endpoints.ts`, sonra `ecafeApi.ts`, lazım olsa `mappers.ts` yenilənməlidir.
