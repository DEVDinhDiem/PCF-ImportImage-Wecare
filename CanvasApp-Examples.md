# Canvas App Integration Examples

## 1. Basic Integration

### Thêm control vào màn hình
```powerFx
// Trong OnVisible của Screen
Set(FileUploadStatus, "");
Set(UploadedFileName, "");
Set(FileContentBase64, "");
```

### Monitor file selection và paste
```powerFx
// Trong OnChange của ImportFile control
If(!IsBlank(ImportFileControl.fileName),
    Set(UploadedFileName, ImportFileControl.fileName);
    Set(FileContentBase64, ImportFileControl.fileContent);
    
    // Kiểm tra xem có phải là hình paste không
    If(StartsWith(ImportFileControl.fileName, "Pasted_Image_"),
        Notify("Hình ảnh đã được paste: " & ImportFileControl.fileName, NotificationType.Information),
        Notify("File đã chọn: " & ImportFileControl.fileName, NotificationType.Information)
    )
);
```

# Handle upload status
```powerFx
// Trong OnChange của ImportFile control cho uploadStatus
Switch(ImportFileControl.uploadStatus,
    "ready", 
    Notify("File sẵn sàng để sử dụng!", NotificationType.Success);
    Set(FileUploadStatus, "ready"),
    
    "error", 
    Notify("Có lỗi với file!", NotificationType.Error);
    Set(FileUploadStatus, "failed")
);
```

## 2. Image Paste Handling

### Xử lý hình ảnh paste đặc biệt
```powerFx
// Kiểm tra file type và xử lý accordingly
With({
    fileName: ImportFileControl.fileName,
    fileContent: ImportFileControl.fileContent
},
    Switch(true,
        // Hình paste
        StartsWith(fileName, "Pasted_Image_"),
        Concurrent(
            Set(ImageSource, "data:image/png;base64," & fileContent),
            Set(ImageDisplayName, "Screenshot " & Text(Now(), "dd/mm/yyyy hh:mm")),
            Notify("Hình ảnh đã được paste thành công", NotificationType.Success)
        ),
        
        // File upload thông thường
        !IsBlank(fileContent),
        Concurrent(
            Set(DocumentContent, fileContent),
            Set(DocumentName, fileName),
            Notify("File đã được chọn: " & fileName, NotificationType.Information)
        )
    )
);
```

### Hiển thị hình ảnh paste trong Image control
```powerFx
// Trong Image control, set Image property:
If(StartsWith(ImportFileControl.fileName, "Pasted_Image_"),
    "data:image/" & 
    Right(ImportFileControl.fileName, Len(ImportFileControl.fileName) - Find(".", ImportFileControl.fileName)) & 
    ";base64," & ImportFileControl.fileContent,
    Blank()
)
```

### Save pasted image to Dataverse
```powerFx
// Tạo record cho hình paste
If(ImportFileControl.uploadStatus = "ready" && StartsWith(ImportFileControl.fileName, "Pasted_Image_"),
    Patch('Custom Images',
        Defaults('Custom Images'),
        {
            Title: "Pasted Image " & Text(Now(), "dd/mm/yyyy hh:mm:ss"),
            'Image Name': ImportFileControl.fileName,
            'Image Content': ImportFileControl.fileContent,
            'Created By': User(),
            'Created On': Now()
        }
    );
    Notify("Hình ảnh đã được lưu vào database", NotificationType.Success)
);
```

## 3. Advanced Integration với Dataverse

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
