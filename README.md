# Import File PCF Control

Đây là một PCF (PowerApps Component Framework) control cho phép import file trong Canvas App và lưu vào Dataverse.

## Tính năng

- ✅ Drag & Drop interface để chọn file
- ✅ **Paste hình ảnh từ clipboard (Ctrl+V)**
- ✅ Hỗ trợ nhiều định dạng file (PDF, Excel, Word, CSV, JSON, images, v.v.)
- ✅ Tự động đặt tên file cho hình paste
- ✅ Status feedback cho người dùng
- ✅ Responsive design
- ✅ Output file content dưới dạng base64 để Canvas App sử dụng

## Cách sử dụng

### 1. Build và Deploy PCF Control

```bash
# Build control
npm run build

# Tạo solution package
pac solution init --publisher-name "YourPublisher" --publisher-prefix "prefix"
pac solution add-reference --path .
pac solution pack --folder "SolutionFolder" --zipfile "ImportFileControl.zip"

# Import vào Power Platform environment
pac solution import --path "ImportFileControl.zip"
```

### 2. Sử dụng trong Canvas App

1. Thêm control vào Canvas App:
   - Chọn "Insert" > "Custom" > "Import components"
   - Chọn "ImportFile" control

2. Bind các output properties:
   - `fileName`: Tên file đã chọn
   - `fileContent`: Nội dung file dưới dạng base64
   - `uploadStatus`: Trạng thái upload (success/error/info)

### 3. Xử lý kết quả upload

```powerFx
// Kiểm tra file đã sẵn sàng
If(ImportFileControl.uploadStatus = "ready",
    Notify("File sẵn sàng: " & ImportFileControl.fileName, NotificationType.Success),
    ImportFileControl.uploadStatus = "error",
    Notify("Có lỗi xảy ra với file", NotificationType.Error)
);

// Lấy thông tin file
Set(SelectedFileName, ImportFileControl.fileName);
Set(FileContentBase64, ImportFileControl.fileContent);

// Upload file tùy chỉnh sử dụng Power Automate hoặc Dataverse
If(!IsBlank(FileContentBase64),
    // Call Power Automate flow hoặc Patch trực tiếp vào Dataverse
    'Upload File Flow'.Run(SelectedFileName, FileContentBase64)
);
```

## Cấu trúc dữ liệu trong Dataverse

Control sẽ tạo record trong bảng `annotation` với các trường:
- `subject`: Tiêu đề (Imported file: [tên file])
- `filename`: Tên file gốc
- `documentbody`: Nội dung file (base64)
- `mimetype`: MIME type của file
- `notetext`: Ghi chú với timestamp

## Các định dạng file được hỗ trợ

- **Document**: PDF, DOC, DOCX
- **Spreadsheet**: XLS, XLSX, CSV
- **Text**: TXT, JSON
- **Image**: PNG, JPG, JPEG, GIF, BMP (bao gồm paste từ clipboard)

## Cách sử dụng Paste Image

1. **Copy hình ảnh**: Từ bất kỳ nguồn nào (web browser, file explorer, screenshot tool)
2. **Click vào control**: Để focus vào PCF control
3. **Paste**: Nhấn `Ctrl+V` để paste hình ảnh
4. **Tự động xử lý**: Control sẽ tự động đặt tên file và convert sang base64

## Customization

Bạn có thể tùy chỉnh:
- CSS trong file `css/ImportFile.css`
- Logic upload trong method `uploadToDataverse()`
- Các định dạng file được hỗ trợ trong method `getMimeType()`

## Troubleshooting

### Lỗi build
- Đảm bảo đã cài đặt PCF CLI: `npm install -g @microsoft/powerapps-cli`
- Kiểm tra Node.js version compatibility

### Lỗi upload
- Kiểm tra quyền WebAPI trong environment
- Đảm bảo entity `annotation` có thể truy cập được
- Kiểm tra file size limit

### Lỗi deployment
- Đảm bảo solution publisher name và prefix hợp lệ
- Kiểm tra quyền deploy trong Power Platform environment

## Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

## Compatibility

- Power Platform PCF Framework 1.0+
- Canvas Apps
- Model-driven Apps
- Power Pages (với một số hạn chế)

## License

MIT License
