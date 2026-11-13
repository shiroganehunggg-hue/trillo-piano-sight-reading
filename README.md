# Trillo — luyện đọc nốt nhạc piano

Trillo là website tiếng Việt giúp luyện nhận diện cao độ trên khuông nhạc và đối chiếu trực tiếp với bàn phím piano ảo. Không cần tài khoản, backend, thư viện ngoài hay bước build; tiến độ được lưu cục bộ trong trình duyệt.

## Chạy trên máy

Mở `index.html` trong trình duyệt. Nếu trình duyệt chặn JavaScript modules trên giao thức `file://`, chạy một máy chủ tĩnh đơn giản trong thư mục dự án, chẳng hạn:

```powershell
py -m http.server 8000
```

Sau đó mở <http://localhost:8000>. Dự án tương thích với GitHub Pages và các nền tảng lưu trữ website tĩnh.

## Các tệp chính

- `index.html` — trang chủ, luyện tập, chế độ và tiến độ; ngôn ngữ giao diện là tiếng Việt.
- `style.css` — hệ thống giao diện responsive và các trạng thái tương tác.
- `music.js` — cao độ MIDI, sinh nốt, ánh xạ hai khóa nhạc, dòng kẻ phụ và cách viết dấu hóa; không phụ thuộc giao diện.
- `app.js` — điều hướng, bàn phím ảo, âm thanh, buổi tập và tiến độ.
- `favicon.svg` — biểu tượng Trillo.

## Cách dùng

1. Chọn **Luyện tập** để bắt đầu ngay; nốt đầu tiên được hiển thị trên khuông nhạc.
2. Chạm phím piano tương ứng. Phím đen là cao độ bán cung, và từng phím thuộc đúng octave.
3. Xem phản hồi, điểm, số câu đúng, độ chính xác và streak; chọn câu tiếp theo.
4. Chọn **Chế độ** để luyện nốt cơ bản, dấu hóa, nốt ngoài khuông hoặc bài tổng hợp; tùy chỉnh khóa nhạc, độ khó, số câu và phạm vi.
5. Chọn **Tiến độ** để xem lịch sử, thời gian luyện và kết quả từng khóa nhạc. Có thể xóa lịch sử từ trang này.

Âm thanh piano được tạo cục bộ bằng Web Audio API và có thể bật/tắt. Các thống kê được lưu trong `localStorage` với khóa `trillo-progress-v1`; dữ liệu không được truyền đi nơi khác.

## Mô hình lý thuyết âm nhạc

- Cao độ được biểu diễn bằng số MIDI tuyệt đối; Do4 là MIDI 60, mỗi phím đen/trắng tăng hoặc giảm đúng một bán cung.
- Vị trí nốt được tính độc lập theo bậc nhạc tự nhiên và khóa: dòng dưới cùng của khóa Sol là Mi4, khóa Fa là Sol2; mỗi bước diatonic cách nhau nửa khoảng dòng.
- Các dòng kẻ phụ được dựng từ tọa độ nốt thực tế, không thay đổi cao độ hay quãng tám.
- Dấu thăng và giáng thay đổi đúng một bán cung so với nốt được viết. Câu dấu bình sử dụng hóa biểu Sol trưởng (Fa♯) hoặc Fa trưởng (Si♭); ký hiệu bình hủy dấu của hóa biểu, trả cao độ về nốt tự nhiên.
- Luyện nốt ngoài khuông chỉ sinh nốt nằm ngoài năm dòng chính. Phạm vi đã chọn giới hạn chính xác cao độ MIDI cần trả lời; nốt thăng/giáng có thể dùng nốt tự nhiên kế cận làm nền, nhưng cao độ cuối vẫn nằm trong phạm vi. Các câu không thể sinh hợp lệ sẽ thông báo thay vì âm thầm mở rộng phạm vi.
- Khóa Fa và khóa Sol ánh xạ lên cùng bàn phím MIDI C2–C6; chấm đáp án bằng MIDI, không chỉ bằng tên nốt.

## Kiểm tra thủ công

- Thử khóa Sol và khóa Fa, rồi bật kết hợp hai khóa.
- Luyện từng chế độ và xác nhận nốt kẻ phụ xuất hiện đúng phía trên hoặc phía dưới khuông.
- Luyện dấu hóa: dấu thăng/giáng có cao độ chênh một bán cung; dấu bình có hóa biểu tương ứng và quay về cao độ tự nhiên.
- Nhấn cùng tên nốt ở octave khác và xác nhận đáp án không bị chấp nhận nhầm.
- Thử đổi phạm vi, số câu, tạm dừng, tiếp tục, kết thúc buổi tập, phát âm thanh và xóa tiến độ.
- Thu nhỏ cửa sổ hoặc mở trên điện thoại; bàn phím có thể cuộn ngang để giữ phím đủ lớn cho thao tác.
