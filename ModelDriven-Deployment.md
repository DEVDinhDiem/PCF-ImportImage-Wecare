# Hướng dẫn triển khai PCF ImportFile với Dataverse Integration

## Tổng quan tính năng mới

PCF control này giờ đây tự động:
1. **Load images** từ bảng `crdfd_multiimages` dựa trên `crdfd_key_data`
2. **Lưu images** trực tiếp vào bảng `crdfd_multiimages`
3. **Quản lý notes** cho từng hình ảnh
4. **Update/Delete** images trực tiếp từ Dataverse

## Cấu trúc bảng crdfd_multiimages

```sql
crdfd_multiimagesid (Primary Key - GUID)
crdfd_image (Image field - stores actual image)
crdfd_image_name (Single Line of Text - filename)
crdfd_notes (Multiple Lines of Text - user notes)
crdfd_key_data (Single Line of Text - foreign key filter)
```

## Ví dụ sử dụng

**Bảng `crdfd_order_request` có cột `crdfd_name` = "OR-1000119":**
- PCF control bind với field `crdfd_name` 
- Tự động load images có `crdfd_key_data = "OR-1000119"`
- Lưu images mới với `crdfd_key_data = "OR-1000119"`

```powershell
# Build PCF control
npm run build

# Tạo solution package
pac solution init --publisher-name "YourPublisher" --publisher-prefix "prefix"
pac solution add-reference --path ./

# Build solution
msbuild /p:configuration=Release

# Import vào environment
pac solution import --path ./bin/Release/YourSolution.zip
```

## Bước 2: Cấu hình trong Power Platform Admin Center

1. **Bật PCF Controls:**
   - Vào Power Platform Admin Center
   - Chọn environment muốn deploy
   - Settings > Product > Features
   - Bật "Power Apps component framework for canvas apps" và "Allow publishing of canvas apps with code components"

## Bước 3: Thêm Control vào Model-driven App

### 3.1. Tạo/Cập nhật Entity Field
```javascript
// Tạo hoặc sử dụng field existing để bind PCF control
// Khuyến nghị: Sử dụng Multiple Lines of Text field
```

### 3.2. Cấu hình Form Control
1. Mở Model-driven App trong Power Apps Maker
2. Vào Tables > [Your Table] > Forms
3. Mở form muốn thêm control
4. Chọn field muốn thay thế bằng PCF control
5. Trong Properties panel:
   - Components tab
   - Click "+ Component"
   - Chọn "ImportFile" control
   - Configure properties nếu cần

### 3.3. Control Properties Configuration
- **Bound Field**: Field để bind control (thường là Multiple Lines of Text)
- **Output Properties**: Sẽ tự động update khi có thay đổi
  - fileName: Tên file đầu tiên
  - fileContent: Nội dung base64 của file đầu tiên  
  - imagesList: JSON array chứa tất cả images và notes
  - imagesCount: Số lượng images đã chọn
  - uploadStatus: Trạng thái upload

## Bước 4: Sử dụng Data trong Business Logic

### 4.1. JavaScript trong Form
```javascript
// Lấy images data từ PCF control
function getImagesData() {
    var control = Xrm.Page.getControl("your_field_name");
    if (control) {
        var imagesList = control.getOutputs().imagesList;
        if (imagesList) {
            var images = JSON.parse(imagesList);
            console.log("Images:", images);
            return images;
        }
    }
    return [];
}

// Lắng nghe thay đổi từ PCF control
Xrm.Page.getControl("your_field_name").addOnOutputChange(function() {
    var images = getImagesData();
    // Process images data
    processImagesData(images);
});
```

### 4.2. Power Automate Flow
```json
{
  "trigger": "When a record is created or modified",
  "condition": "ImagesList field is not empty",
  "actions": [
    {
      "parseJson": {
        "content": "@{triggerOutputs()?['body/your_imageslist_field']}",
        "schema": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": {"type": "string"},
              "content": {"type": "string"},
              "size": {"type": "number"},
              "type": {"type": "string"},
              "note": {"type": "string"}
            }
          }
        }
      }
    },
    {
      "forEach": {
        "items": "@body('Parse_JSON')",
        "actions": [
          {
            "createFile": {
              "site": "SharePoint Site",
              "folderPath": "/Documents",
              "name": "@{items('Apply_to_each')?['name']}",
              "body": "@{base64ToBinary(items('Apply_to_each')?['content'])}"
            }
          }
        ]
      }
    }
  ]
}
```

## Bước 5: Security và Permissions

### 5.1. Security Roles
- Đảm bảo users có quyền "Read" và "Write" trên entity chứa PCF control
- Có thể cần "Create" và "Delete" permissions tùy business logic

### 5.2. Field Level Security
- Cấu hình field security nếu cần hạn chế access
- PCF control sẽ respect field permissions

## Bước 6: Testing và Troubleshooting

### 6.1. Browser Console
```javascript
// Debug PCF control outputs
var control = Xrm.Page.getControl("your_field_name");
console.log("Control outputs:", control.getOutputs());
```

### 6.2. Common Issues
1. **PCF Control không hiển thị**: Kiểm tra solution import và enable features
2. **Data không save**: Verify field permissions và data types
3. **Performance issues**: Monitor file sizes và số lượng images

## Bước 7: Production Deployment

1. **Export Solution từ Dev Environment**
2. **Import vào Test Environment** - validate functionality
3. **Import vào Production Environment**
4. **Monitor usage và performance**

## Lưu ý quan trọng

- **File Size Limits**: Model-driven apps có giới hạn field size (~1MB for Multiple Lines of Text)
- **Browser Compatibility**: Test trên tất cả browsers được support
- **Mobile Experience**: PCF control sẽ hoạt động trên mobile Power Apps
- **Offline Capability**: Consider offline scenarios nếu cần

## Data Structure Example

```json
[
  {
    "name": "image1.png",
    "content": "iVBORw0KGgoAAAANSUhEUgAA...",
    "size": 1024000,
    "type": "image/png",
    "index": 0,
    "note": "Ghi chú cho ảnh 1"
  },
  {
    "name": "image2.jpg", 
    "content": "/9j/4AAQSkZJRgABAQAAAQAB...",
    "size": 2048000,
    "type": "image/jpeg",
    "index": 1,
    "note": "Ghi chú cho ảnh 2"
  }
]
```
