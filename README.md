# Import Images PCF Control

Đây là một PCF (PowerApps Component Framework) control cho phép import nhiều hình ảnh trong Canvas App với preview và quản lý.

## Tính năng

- ✅ **Upload nhiều hình ảnh** từ file explorer
- ✅ **Drag & Drop interface** để chọn nhiều file
- ✅ **Paste hình ảnh từ clipboard (Ctrl+V)**
- ✅ **Preview grid** hiển thị tất cả hình ảnh đã chọn
- ✅ **Ghi chú cho từng hình**: Textarea để nhập ghi chú cho mỗi hình ảnh
- ✅ **Quản lý hình ảnh**: Xóa từng hình hoặc xóa tất cả
- ✅ **Hỗ trợ định dạng**: PNG, JPG, JPEG, GIF, BMP, WEBP
- ✅ **Tự động đặt tên** file cho hình paste
- ✅ **Output JSON array** chứa tất cả hình ảnh kèm ghi chú để Canvas App sử dụng
- ✅ **Responsive design** hoạt động trên desktop và mobile

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
   - `fileName`: Tên file đầu tiên (backward compatibility)
   - `fileContent`: Nội dung file đầu tiên dưới dạng base64 (backward compatibility)  
   - `uploadStatus`: Trạng thái (ready khi có ảnh)
   - `imagesList`: JSON array chứa tất cả hình ảnh
   - `imagesCount`: Số lượng hình ảnh đã chọn

### 3. Xử lý kết quả - Nhiều hình ảnh

```powerFx
// Parse danh sách hình ảnh
Set(ImagesCollection, 
    ForAll(
        ParseJSON(ImportImagesControl.imagesList),
        {
            Name: Text(ThisRecord.name),
            Content: Text(ThisRecord.content),
            Size: Value(Text(ThisRecord.size)),
            Type: Text(ThisRecord.type)
        }
    )
);

// Kiểm tra số lượng hình
If(ImportImagesControl.imagesCount > 0,
    Notify($"Đã chọn {ImportImagesControl.imagesCount} hình ảnh", NotificationType.Success)
);

// Lưu tất cả hình vào Dataverse
ForAll(ImagesCollection,
    Patch('Image Gallery',
        Defaults('Image Gallery'),
        {
            'Image Name': Name,
            'Image Content': Content,
            'File Size': Size,
            'Content Type': Type,
            'Upload Date': Now()
        }
    )
);
```

### 4. Xử lý từng hình riêng lẻ

```powerFx
// Hiển thị trong Gallery control
// Gallery Items property:
ParseJSON(ImportImagesControl.imagesList)

// Trong Gallery, Image control:
"data:image/" & 
Right(Text(ThisItem.type), Len(Text(ThisItem.type)) - Find("/", Text(ThisItem.type))) & 
";base64," & Text(ThisItem.content)
```

## Cấu trúc dữ liệu Output

### imagesList (JSON Array)
```json
[
  {
    "name": "image1.jpg",
    "content": "base64_encoded_content",
    "size": 12345,
    "type": "image/jpeg",
    "index": 0,
    "note": "Hình ảnh sản phẩm mới"
  },
  {
    "name": "Pasted_Image_1641234567890.png", 
    "content": "base64_encoded_content",
    "size": 67890,
    "type": "image/png",
    "index": 1,
    "note": "Screenshot từ meeting"
  }
]
```

### Backward Compatibility
- `fileName`: Tên của hình đầu tiên
- `fileContent`: Base64 content của hình đầu tiên  
- `uploadStatus`: "ready" khi có hình ảnh

## Các định dạng được hỗ trợ

- **Image formats**: PNG, JPG, JPEG, GIF, BMP, WEBP
- **Paste support**: Tất cả format image từ clipboard

## Cách sử dụng

### Upload Multiple Images
1. **Click để chọn nhiều file**: Giữ Ctrl và click để chọn nhiều hình
2. **Drag & Drop**: Kéo thả nhiều file hình ảnh cùng lúc  
3. **Paste từ clipboard**: Copy hình từ bất kỳ đâu và Ctrl+V

### Quản lý hình ảnh
1. **Preview**: Tất cả hình sẽ hiển thị trong grid với thumbnail
2. **Xóa từng hình**: Click nút "×" trên mỗi hình
3. **Xóa tất cả**: Click nút "Xóa tất cả" 
4. **Thông tin chi tiết**: Tên file và dung lượng hiển thị dưới mỗi hình
5. **Ghi chú**: Textarea để nhập ghi chú cho từng hình ảnh

### Tích hợp Canvas App
1. Control tự động update `imagesCount` và `imagesList` 
2. Parse JSON để lấy thông tin từng hình
3. Sử dụng base64 content để hiển thị hoặc lưu trữ

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
