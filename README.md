# ECafe Frontend

React + TypeScript + Vite frontend layihəsi.

## İşə salmaq

```powershell
npm install
npm run dev
```

Frontend default olaraq burada açılır:

```text
http://127.0.0.1:5173/
```

Dev mühitində `/api/v1` sorğuları `vite.config.ts` vasitəsilə backend-ə yönləndirilir:

```text
http://localhost:8080
```

Backend başqa portda işləyirsə, kodu dəyişmə. `.env.local` faylında proxy target-i seç:

```powershell
# Visual Studio Local API
VITE_DEV_API_PROXY_TARGET=http://localhost:8080
VITE_PUBLIC_API_ORIGIN=http://localhost:8080

# Docker API
VITE_DEV_API_PROXY_TARGET=http://localhost:8081
VITE_PUBLIC_API_ORIGIN=http://localhost:8081
```

`.env.example` local debug üçündür, `.env.docker.example` isə Docker API-yə qoşulmaq üçün nümunədir.

## Build

```powershell
npm run build
```

## Struktur

```text
src/shared/api
```

Backend endpoint-ləri və mapper-lər buradadır. Backend-i çox bilmədən frontend inteqrasiyasını idarə etmək üçün əvvəl bu qovluğa bax:

- `endpoints.ts`: bütün endpoint URL-ləri
- `httpClient.ts`: token və fetch məntiqi
- `mappers.ts`: backend response -> frontend model çevirmə
- `ecafeApi.ts`: səhifələrin çağırdığı rahat API
- `README.md`: API qovluğu üzrə izah

```text
src/shared/hooks/useAsyncData.ts
```

Səhifələrdə loading/data logic-i təkrar yazılmasın deyə istifadə olunur.

## Hazır backend flow-lara qoşulan hissələr

- Login/register
- Public restoran kataloqu
- Restoran profili
- Public menyu
- Public staff
- Public tables
- Admin restoran/müqavilə/menu/table/staff listləri

## Hələ backend gözləyən hissələr

- Reservation
- Walk-in/TableSession
- Order
- Kitchen
- Payment/Settlement
- Notification list/read

Bu hissələr frontend-də demo/placeholder olaraq saxlanılıb ki UI sınmasın.
