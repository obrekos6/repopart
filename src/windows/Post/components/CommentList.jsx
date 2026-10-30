import React from 'react';
import CommentItem from './CommentItem';
import './Comment.css';

function CommentList({ comments, currentUser, onDelete, onOpenProfile }, ref) {
  return (
    <div className="comment-list" ref={ref}>
      {comments.map((c) => (
        <CommentItem
          key={c.id}
          comment={c}
          currentUser={currentUser}
          onDelete={onDelete}
          onOpenProfile={onOpenProfile}
        />
      ))}
    </div>
  );
}

export default React.forwardRef(CommentList);