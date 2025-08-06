# Canvas App Integration Examples - Multiple Images

## 1. Basic Integration

### Thêm control vào màn hình
```powerFx
// Trong OnVisible của Screen
Set(FileUploadStatus, "");
Set(SelectedImages, []);
Set(ImagesCount, 0);
```

### Monitor images selection và paste
```powerFx
// Trong OnChange của ImportImagesControl
If(ImportImagesControl.imagesCount > 0,
    // Parse images list with notes
    Set(SelectedImages, 
        ForAll(
            ParseJSON(ImportImagesControl.imagesList),
            {
                Name: Text(ThisRecord.name),
                Content: Text(ThisRecord.content),
                Size: Value(Text(ThisRecord.size)),
                Type: Text(ThisRecord.type),
                Index: Value(Text(ThisRecord.index)),
                Note: Text(ThisRecord.note)
            }
        )
    );
    Set(ImagesCount, ImportImagesControl.imagesCount);
    
    // Show notification
    Notify($"Đã chọn {ImportImagesControl.imagesCount} hình ảnh", NotificationType.Success);
    
    // Update status
    Set(FileUploadStatus, "ready")
);
```

## 2. Gallery Display với Multiple Images

### Hiển thị tất cả hình trong Gallery
```powerFx
// Gallery Items property:
SelectedImages

// Trong Gallery - Image control:
"data:" & ThisItem.Type & ";base64," & ThisItem.Content

// Label hiển thị tên file:
ThisItem.Name

// Label hiển thị ghi chú:
If(IsBlank(ThisItem.Note), 
    "(Chưa có ghi chú)", 
    ThisItem.Note
)

// Label hiển thị size:
If(ThisItem.Size < 1024, 
    Text(ThisItem.Size) & " bytes",
    If(ThisItem.Size < 1024*1024,
        Text(Round(ThisItem.Size/1024, 1)) & " KB", 
        Text(Round(ThisItem.Size/(1024*1024), 1)) & " MB"
    )
)
```

### Batch Upload tất cả hình với notes
```powerFx
// Button OnSelect - Upload all images with notes
ForAll(SelectedImages,
    Patch('Image Storage',
        Defaults('Image Storage'),
        {
            'File Name': Name,
            'File Content': Content,
            'File Size': Size,
            'Content Type': Type,
            'Image Note': If(IsBlank(Note), "", Note),
            'Upload Date': Now(),
            'Uploaded By': User().Email
        }
    )
);
Notify($"Đã upload {CountRows(SelectedImages)} hình ảnh với ghi chú", NotificationType.Success);
```

## 3. Advanced Image Processing

### Lọc hình theo loại
```powerFx
// Chỉ lấy hình JPG/JPEG
Set(JpegImages, 
    Filter(SelectedImages, 
        ThisRecord.Type = "image/jpeg" || ThisRecord.Type = "image/jpg"
    )
);

// Chỉ lấy hình PNG
Set(PngImages, 
    Filter(SelectedImages, ThisRecord.Type = "image/png")
);

// Lọc hình theo size (< 1MB)
Set(SmallImages,
    Filter(SelectedImages, ThisRecord.Size < 1024*1024)
);
```

## 4. Notes Management

### Lọc hình có ghi chú và không có ghi chú
```powerFx
// Hình có ghi chú
Set(ImagesWithNotes, 
    Filter(SelectedImages, !IsBlank(ThisRecord.Note))
);

// Hình không có ghi chú
Set(ImagesWithoutNotes, 
    Filter(SelectedImages, IsBlank(ThisRecord.Note))
);

// Thống kê
Set(NotesStats, {
    Total: CountRows(SelectedImages),
    WithNotes: CountRows(ImagesWithNotes),
    WithoutNotes: CountRows(ImagesWithoutNotes)
});
```

### Tìm kiếm hình theo nội dung ghi chú
```powerFx
// Search trong notes
Set(SearchResults,
    Filter(SelectedImages, 
        SearchKeyword in Lower(ThisRecord.Note) ||
        SearchKeyword in Lower(ThisRecord.Name)
    )
);
```

### Validation notes trước khi upload
```powerFx
// Kiểm tra hình nào chưa có ghi chú
Set(MissingNotes,
    Filter(SelectedImages, IsBlank(ThisRecord.Note))
);

If(CountRows(MissingNotes) > 0,
    // Hiển thị cảnh báo
    Set(ShowNoteWarning, true);
    Set(WarningMessage, 
        $"Có {CountRows(MissingNotes)} hình chưa có ghi chú. Bạn có muốn tiếp tục?"
    ),
    // Cho phép upload
    Set(CanUpload, true)
);
```

## 5. Advanced Integration với Dataverse

### Tạo custom entity để track uploads
```powerFx
// Sau khi upload thành công, tạo record tracking
Patch('Custom File Uploads',
    Defaults('Custom File Uploads'),
    {
        'File Name': ImportFileControl.fileName,
        'Upload Date': Now(),
        'Uploaded By': User(),
        'File Size': Len(ImportFileControl.fileContent) * 3 / 4, // Estimate from base64
        'Upload Status': ImportFileControl.uploadStatus
    }
);
```

### Query uploaded files
```powerFx
// Get danh sách files đã upload
ClearCollect(UploadedFiles,
    Filter(Annotations,
        StartsWith(subject, "Imported file:")
    )
);
```

## 3. File Processing Workflow

### Xử lý file Excel/CSV
```powerFx
// Sau khi upload, có thể process file content
If(EndsWith(Lower(ImportFileControl.fileName), ".csv"),
    // Process CSV content
    Set(ProcessingMode, "csv");
    Notify("Đang xử lý file CSV...", NotificationType.Information),
    
    EndsWith(Lower(ImportFileControl.fileName), ".xlsx"),
    // Process Excel content  
    Set(ProcessingMode, "excel");
    Notify("Đang xử lý file Excel...", NotificationType.Information)
);
```

### Integration với Power Automate
```powerFx
// Trigger Power Automate flow sau khi upload
If(ImportFileControl.uploadStatus = "success",
    // Call Power Automate flow
    'Process Uploaded File'.Run(
        ImportFileControl.fileName,
        ImportFileControl.fileContent
    );
    Notify("Đã gửi file để xử lý...", NotificationType.Information)
);
```

## 4. UI/UX Enhancements

### Loading overlay
```powerFx
// Hiển thị loading khi đang upload
If(ImportFileControl.uploadStatus = "info",
    Set(ShowLoadingOverlay, true),
    Set(ShowLoadingOverlay, false)
);
```

### File validation
```powerFx
// Validate file trước khi cho phép upload
With({
    fileExt: Right(ImportFileControl.fileName, 4)
},
    If(fileExt in [".pdf", ".doc", "docx", ".xls", "xlsx", ".csv"],
        // File hợp lệ
        Set(FileValidation, true),
        // File không hợp lệ
        Set(FileValidation, false);
        Notify("Định dạng file không được hỗ trợ!", NotificationType.Error)
    )
);
```

### Progress feedback
```powerFx
// Hiển thị progress trong Text control
If(ImportFileControl.uploadStatus = "info",
    "Đang upload " & ImportFileControl.fileName & "...",
    ImportFileControl.uploadStatus = "success",
    "✅ Upload hoàn tất: " & ImportFileControl.fileName,
    ImportFileControl.uploadStatus = "error", 
    "❌ Upload thất bại: " & ImportFileControl.fileName,
    "Chọn file để upload"
)
```

## 5. Error Handling

### Comprehensive error handling
```powerFx
Switch(ImportFileControl.uploadStatus,
    "error",
    Concurrent(
        Set(ErrorMessage, "Upload failed. Please try again."),
        Set(ShowError, true),
        Trace("File upload failed: " & ImportFileControl.fileName, TraceSeverity.Error)
    ),
    
    "success",
    Concurrent(
        Set(ErrorMessage, ""),
        Set(ShowError, false),
        Trace("File uploaded successfully: " & ImportFileControl.fileName, TraceSeverity.Information)
    )
);
```

### Retry mechanism
```powerFx
// Button để retry upload
If(FileUploadRetryCount < 3,
    Set(FileUploadRetryCount, FileUploadRetryCount + 1);
    // Reset control để retry
    Reset(ImportFileControl);
    Notify("Đang thử lại... (Lần " & FileUploadRetryCount & "/3)", NotificationType.Information),
    
    Notify("Đã thử tối đa 3 lần. Vui lòng liên hệ admin.", NotificationType.Error)
);
```

## 6. Analytics và Reporting

### Track usage statistics
```powerFx
// Patch usage statistics
Patch('Upload Statistics',
    Defaults('Upload Statistics'),
    {
        'Upload Date': Today(),
        'User': User().Email,
        'File Type': Right(ImportFileControl.fileName, 4),
        'Success': ImportFileControl.uploadStatus = "success"
    }
);
```

### Generate reports
```powerFx
// Tạo báo cáo upload theo ngày
ClearCollect(DailyUploadStats,
    GroupBy(
        Filter('Upload Statistics', 'Upload Date' >= Today() - 30),
        "Upload Date",
        "DailyStats"
    )
);
```
