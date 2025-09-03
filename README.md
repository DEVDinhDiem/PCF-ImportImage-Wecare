# PCF Import Images Control - Hướng dẫn đầy đủ

## 🚀 Cài đặt nhanh

```bash
# 1. Clone và cài đặt
git clone <repository-url>
cd PCF-ImportImage-Wecare
npm install

# 2. Build và test local
npm run build
npm start watch

# 3. Cập nhật version number
File ControlManifest.Input.xml và package.json

# 3. Deploy lên môi trường
pac pcf push --publisher-prefix crdfd
```

## 📖 Tổng quan

**Import Images PCF Control** là component cho Power Platform cho phép upload và quản lý nhiều hình ảnh trong Canvas App với giao diện trực quan và dễ sử dụng.

### ✨ Tính năng chính

| Tính năng | Mô tả |
|-----------|--------|
| 🔄 **Multi-upload** | Upload nhiều hình cùng lúc từ file explorer |
| 🎯 **Drag & Drop** | Kéo thả trực tiếp nhiều file vào control |
| 📋 **Paste Support** | Paste hình từ clipboard (Ctrl+V) |
| 🖼️ **Live Preview** | Xem trước tất cả hình trong grid layout |
| 📝 **Ghi chú** | Thêm ghi chú cho từng hình ảnh |
| 🗑️ **Quản lý** | Xóa từng hình hoặc xóa tất cả |
| 🎨 **Responsive** | Hoạt động tốt trên mọi thiết bị |

### 📋 Định dạng hỗ trợ
**PNG, JPG, JPEG, GIF, BMP, WEBP**

## 🛠️ Hướng dẫn triển khai

### Bước 1: Build PCF Control

```bash
# Build control
npm run build

# Tạo solution
pac solution init --publisher-name "WecarePublisher" --publisher-prefix "wec"
pac solution add-reference --path .
pac solution pack --folder "Solution" --zipfile "ImportImagesControl.zip"
```

### Bước 2: Import vào Power Platform

```bash
# Import solution
pac solution import --path "ImportImagesControl.zip"
```

### Bước 3: Thêm vào Canvas App

1. **Insert → Custom → Import components**
2. Chọn **"ImportImages"** control
3. Kéo control vào canvas

## 💻 Sử dụng trong Canvas App

### Properties và Output

| Property | Type | Mô tả |
|----------|------|--------|
| `imagesList` | JSON Array | Danh sách tất cả hình ảnh |
| `imagesCount` | Number | Số lượng hình đã chọn |
| `uploadStatus` | Text | Trạng thái: "ready" khi có hình |
| `fileName` | Text | Tên file đầu tiên (legacy) |
| `fileContent` | Text | Base64 của file đầu tiên (legacy) |

### Xử lý dữ liệu - Multiple Images

```powerFx
// 1. Parse danh sách hình ảnh
Set(ImagesData, 
    ForAll(
        ParseJSON(ImportImagesControl.imagesList),
        {
            FileName: Text(ThisRecord.name),
            FileContent: Text(ThisRecord.content),
            FileSize: Value(Text(ThisRecord.size)),
            ContentType: Text(ThisRecord.type),
            UserNote: Text(ThisRecord.note),
            ImageIndex: Value(Text(ThisRecord.index))
        }
    )
);

// 2. Hiển thị thông báo
If(ImportImagesControl.imagesCount > 0,
    Notify($"✅ Đã chọn {ImportImagesControl.imagesCount} hình ảnh", NotificationType.Success),
    Notify("⚠️ Chưa chọn hình ảnh nào", NotificationType.Warning)
);

// 3. Lưu vào Dataverse/SharePoint
ForAll(ImagesData,
    Patch('Images Library',
        Defaults('Images Library'),
        {
            Title: FileName,
            ImageContent: FileContent,
            FileSize: FileSize,
            ContentType: ContentType,
            Notes: UserNote,
            UploadDate: Now(),
            UploadedBy: User().FullName
        }
    )
);
```

### Hiển thị trong Gallery

```powerFx
// Gallery Items property
ParseJSON(ImportImagesControl.imagesList)

// Image control trong Gallery
"data:" & Text(ThisItem.type) & ";base64," & Text(ThisItem.content)

// Label hiển thị tên file
Text(ThisItem.name)

// Label hiển thị ghi chú
Text(ThisItem.note)
```

## 📊 Cấu trúc dữ liệu

### JSON Output Format

```json
[
  {
    "name": "product-image.jpg",
    "content": "iVBORw0KGgoAAAANSUhEUgAAA...",
    "size": 156789,
    "type": "image/jpeg",
    "index": 0,
    "note": "Hình ảnh sản phẩm chính"
  },
  {
    "name": "Pasted_Image_1641234567890.png",
    "content": "iVBORw0KGgoAAAANSUhEUgAAA...",
    "size": 89012,
    "type": "image/png", 
    "index": 1,
    "note": "Screenshot từ meeting với khách hàng"
  }
]
```

## 🎯 Best Practices

### 1. Performance Optimization

```powerFx
// Chỉ process khi có thay đổi
If(ImportImagesControl.imagesCount <> PreviousCount,
    Set(PreviousCount, ImportImagesControl.imagesCount);
    Set(ImagesData, ParseJSON(ImportImagesControl.imagesList))
);
```

### 2. Error Handling

```powerFx
// Kiểm tra và xử lý lỗi
If(IsError(ParseJSON(ImportImagesControl.imagesList)),
    Notify("❌ Lỗi xử lý dữ liệu hình ảnh", NotificationType.Error),
    // Process normal
    Set(ImagesData, ParseJSON(ImportImagesControl.imagesList))
);
```

### 3. File Size Validation

```powerFx
// Lọc file quá lớn (> 5MB)
Set(ValidImages, 
    Filter(ImagesData, FileSize <= 5242880)
);

Set(InvalidImages,
    Filter(ImagesData, FileSize > 5242880)
);

If(CountRows(InvalidImages) > 0,
    Notify($"⚠️ {CountRows(InvalidImages)} file vượt quá 5MB", NotificationType.Warning)
);
```

## 🔧 Customization

### CSS Styling
Chỉnh sửa `css/ImportFile.css`:

```css
/* Custom preview grid */
.preview-grid {
    gap: 15px;
    padding: 20px;
}

/* Custom upload area */
.upload-area {
    border: 2px dashed #007acc;
    border-radius: 10px;
}
```

### Supported File Types
Chỉnh sửa trong `getMimeType()` method để thêm format mới.

## 🐛 Troubleshooting

### Build Issues
```bash
# Kiểm tra PCF CLI version
pac --version

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Clear build cache
npm run build -- --clean
```

### Runtime Issues

| Lỗi | Nguyên nhân | Giải pháp |
|-----|-------------|-----------|
| "JSON parse error" | Dữ liệu không hợp lệ | Kiểm tra `imagesList` property |
| "Upload failed" | Quyền truy cập | Kiểm tra permissions trong environment |
| "File too large" | Vượt quá giới hạn | Giảm kích thước file hoặc tăng limit |

### Environment Setup
```bash
# Kiểm tra environment connection
pac org list

# Switch environment nếu cần
pac org select --environment [environment-id]

# Verify PCF control
pac pcf list
```

## 📱 Mobile Compatibility

Control hoạt động tốt trên mobile với:
- Touch-friendly interface
- Responsive grid layout  
- Camera integration (qua file input)
- Optimized for touch gestures

## 🔄 Development Workflow

```bash
# Development mode
npm start watch

# Testing
npm run test

# Code quality
npm run lint
npm run lint:fix

# Production build
npm run build --production
```

## 📄 License & Support

- **License**: MIT
- **Support**: Tạo issue trong repository
- **Compatibility**: PCF Framework 1.0+, Canvas Apps, Model-driven Apps

---

> 💡 **Tip**: Sử dụng browser dev tools để debug và monitor performance khi phát triển với control này.
